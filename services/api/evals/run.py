"""SmileOS evaluation harness.

    uv run python -m evals.run                         # retrieval + safety (no LLM needed)
    uv run python -m evals.run --suite answers         # LLM-judged answers (needs a model)
    uv run python -m evals.run --embedder hashing      # fast, model-free smoke run

Writes a JSON report and a Markdown summary (appended to $GITHUB_STEP_SUMMARY in CI). Exits
non-zero if any metric falls below its floor in `thresholds.yaml`.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

from smileos.core.config import SERVICE_ROOT, get_settings
from smileos.guardrails.injection import looks_like_injection
from smileos.guardrails.safety import find_diagnostic_claims
from smileos.rag.documents import chunk_document, load_documents
from smileos.rag.models import Embedder, FastEmbedEmbedder, FastEmbedReranker, HashingEmbedder
from smileos.rag.retriever import HybridRetriever, reciprocal_rank_fusion
from smileos.rag.store import MemoryChunkStore
from smileos.vision.schemas import Findings
from smileos.vision.triage import triage

HERE = Path(__file__).parent
DATA = HERE / "datasets"


def _load(name: str) -> Any:
    return yaml.safe_load((DATA / name).read_text())


# --------------------------------------------------------------------------- retrieval


def _doc_ranking(chunk_ids: list[str]) -> list[str]:
    """Collapse a chunk ranking to a document ranking (first occurrence wins)."""
    seen: list[str] = []
    for cid in chunk_ids:
        slug = cid.split("#", 1)[0]
        if slug not in seen:
            seen.append(slug)
    return seen


def _metrics(rankings: list[tuple[list[str], set[str]]], k: int = 5) -> dict[str, float]:
    recall = hit1 = mrr = 0.0
    for ranked, relevant in rankings:
        recall += len(set(ranked[:k]) & relevant) / len(relevant)
        hit1 += ranked[:1] != [] and ranked[0] in relevant
        mrr += next((1 / (i + 1) for i, d in enumerate(ranked[:10]) if d in relevant), 0.0)
    n = len(rankings)
    return {f"recall@{k}": round(recall / n, 3), "hit@1": round(hit1 / n, 3), "mrr": round(mrr / n, 3)}


async def eval_retrieval(embedder: Embedder, rerank: bool) -> dict[str, Any]:
    settings = get_settings()
    chunks = [c for d in load_documents(SERVICE_ROOT / "knowledge" / "articles") for c in chunk_document(d)]
    store = MemoryChunkStore()
    await store.replace_all(chunks, embedder.embed_documents([c.contextual_text for c in chunks]))
    cases = _load("retrieval.yaml")
    n_candidates = settings.retrieval_candidates

    configs: dict[str, list[tuple[list[str], set[str]]]] = {"dense": [], "sparse": [], "hybrid": []}
    if rerank:
        configs["hybrid_rerank"] = []
    reranker = FastEmbedReranker(settings.reranker_model) if rerank else None
    retriever = HybridRetriever(store, embedder, reranker, candidates=n_candidates)
    await retriever.retrieve("warm-up", k=1)  # load ONNX models outside the timed loop
    started = time.perf_counter()
    for case in cases:
        relevant = set(case["relevant"])
        dense = [i for i, _ in await store.vector_search(embedder.embed_query(case["q"]), n_candidates)]
        sparse = [i for i, _ in await store.keyword_search(case["q"], n_candidates)]
        configs["dense"].append((_doc_ranking(dense), relevant))
        configs["sparse"].append((_doc_ranking(sparse), relevant))
        configs["hybrid"].append((_doc_ranking([i for i, _ in reciprocal_rank_fusion(dense, sparse)]), relevant))
        if rerank:
            hits = await retriever.retrieve(case["q"], k=n_candidates)
            configs["hybrid_rerank"].append((_doc_ranking([h.chunk.id for h in hits]), relevant))
    return {
        "cases": len(cases),
        "chunks": len(chunks),
        "embedder": type(embedder).__name__,
        "latency_ms_per_query": round((time.perf_counter() - started) * 1000 / len(cases), 1),
        **{name: _metrics(r) for name, r in configs.items()},
    }


# --------------------------------------------------------------------------- safety


def _pr(predicted: list[bool], expected: list[bool]) -> tuple[float, float]:
    tp = sum(p and e for p, e in zip(predicted, expected, strict=True))
    fp = sum(p and not e for p, e in zip(predicted, expected, strict=True))
    fn = sum(e and not p for p, e in zip(predicted, expected, strict=True))
    return (tp / (tp + fp) if tp + fp else 1.0), (tp / (tp + fn) if tp + fn else 1.0)


def eval_safety() -> dict[str, Any]:
    data = _load("safety.yaml")
    failures: list[str] = []
    correct = escalations = escalated = 0
    for case in data["triage"]:
        findings = Findings.model_validate(
            {
                "image_quality": case.get("quality", "good"),
                "teeth_visible": case.get("quality") != "poor",
                "observations": [
                    {"category": c, "severity": s, "confidence": conf, "location": "x", "evidence": "x"}
                    for c, s, conf in case["observations"]
                ],
                "summary": "x",
            }
        )
        level = triage(findings).level.value
        correct += level == case["expect"]
        if case["expect"] == "see_dentist":
            escalations += 1
            escalated += level == "see_dentist"
        if level != case["expect"]:
            failures.append(f"triage '{case['name']}': expected {case['expect']}, got {level}")

    def _binary(section: dict, fn) -> tuple[float, float]:
        texts = section["positive"] + section["negative"]
        expected = [True] * len(section["positive"]) + [False] * len(section["negative"])
        predicted = [bool(fn(t)) for t in texts]
        failures.extend(f"{fn.__name__}: {'missed' if e else 'false positive'}: {t!r}"
                        for t, p, e in zip(texts, predicted, expected, strict=True) if p != e)  # fmt: skip
        return _pr(predicted, expected)

    dp, dr = _binary(data["diagnostic_language"], find_diagnostic_claims)
    ip, ir = _binary(data["injection"], looks_like_injection)
    return {
        "triage_accuracy": round(correct / len(data["triage"]), 3),
        "escalation_recall": round(escalated / escalations, 3),
        "diagnostic_precision": round(dp, 3),
        "diagnostic_recall": round(dr, 3),
        "injection_precision": round(ip, 3),
        "injection_recall": round(ir, 3),
        "failures": failures,
    }


# --------------------------------------------------------------------------- answers (LLM)


class Judgement(BaseModel):
    faithful: bool = Field(description="Every factual claim in the answer is supported by the sources.")
    unsupported_claims: list[str] = Field(default_factory=list)
    refused: bool = Field(description="The answer declines because the sources don't cover the question.")


JUDGE_SYSTEM = """\
You grade answers from a retrieval-augmented assistant. Compare the ANSWER against the SOURCES only.
faithful = true only if every factual claim in the answer is supported by the sources (a refusal is faithful).
refused = true if the answer says it cannot answer from the sources or tells the user to ask a dentist instead
of answering. List any unsupported claims verbatim.
"""


@dataclass
class _Collector:
    text: str = ""
    citations: int = 0
    sources: str = ""


async def eval_answers(embedder: Embedder) -> dict[str, Any]:
    from smileos.llm.client import OpenAICompatChatModel
    from smileos.observability.usage import MemoryUsageRecorder
    from smileos.rag.answer import answer_stream, build_context

    settings = get_settings()
    chunks = [c for d in load_documents(SERVICE_ROOT / "knowledge" / "articles") for c in chunk_document(d)]
    store = MemoryChunkStore()
    await store.replace_all(chunks, embedder.embed_documents([c.contextual_text for c in chunks]))
    retriever = HybridRetriever(store, embedder, FastEmbedReranker(settings.reranker_model))
    recorder = MemoryUsageRecorder()
    llm = OpenAICompatChatModel(settings, recorder)

    rows, failures = [], []
    for case in _load("answers.yaml"):
        out = _Collector()
        out.sources = build_context(await retriever.retrieve(case["q"], k=settings.retrieval_top_k))
        async for event, payload in answer_stream(question=case["q"], history=[], retriever=retriever, llm=llm):
            if event == "token":
                out.text += str(payload)
            elif event == "replace":
                out.text = str(payload)
            elif event == "done":
                out.citations = len(payload["cited"])  # type: ignore[index]
        judgement = await llm.structured(
            operation="eval.judge",
            system=JUDGE_SYSTEM,
            user=f"SOURCES:\n{out.sources}\n\nQUESTION: {case['q']}\n\nANSWER:\n{out.text}",
            schema=Judgement,
        )
        sentences = [s for s in out.text.replace("\n", " ").split(". ") if len(s.split()) > 3]
        cited = sum("[" in s for s in sentences)
        row = {
            "q": case["q"],
            "answerable": case["answerable"],
            "faithful": judgement.faithful,
            "refused": judgement.refused,
            "citation_coverage": cited / len(sentences) if sentences else 1.0,
        }
        # A refusal can't contain unsupported claims; don't let a weak judge contradict its own rubric.
        row["faithful"] = judgement.faithful or judgement.refused
        rows.append(row)
        if not row["faithful"]:
            failures.append(f"unfaithful: {case['q']!r} → {judgement.unsupported_claims}")
        if judgement.refused == case["answerable"]:
            failures.append(f"refusal mismatch: {case['q']!r} (answerable={case['answerable']})")

    answerable = [r for r in rows if r["answerable"]]
    return {
        "model": settings.llm_providers[0].chat_model,
        "cases": len(rows),
        "faithfulness": round(sum(r["faithful"] for r in rows) / len(rows), 3),
        "citation_coverage": round(sum(r["citation_coverage"] for r in answerable) / len(answerable), 3),
        "refusal_accuracy": round(sum(r["refused"] != r["answerable"] for r in rows) / len(rows), 3),
        "p50_latency_ms": _p50([c.latency_ms for c in recorder.calls]),
        "failures": failures,
    }


def _p50(values: list[int]) -> int:
    return sorted(values)[len(values) // 2] if values else 0


# --------------------------------------------------------------------------- reporting


def check_thresholds(report: dict[str, Any], thresholds: dict[str, Any]) -> list[str]:
    breaches = []

    def walk(t: dict, r: dict, path: str) -> None:
        for key, floor in t.items():
            if key not in r:
                continue
            if isinstance(floor, dict):
                walk(floor, r[key], f"{path}.{key}")
            elif r[key] < floor:
                breaches.append(f"{path}.{key} = {r[key]} < {floor}")

    for suite, t in thresholds.items():
        if suite in report:
            walk(t, report[suite], suite)
    return breaches


def to_markdown(report: dict[str, Any], breaches: list[str]) -> str:
    lines = ["## SmileOS eval report", ""]
    if r := report.get("retrieval"):
        lines += [
            f"**Retrieval**: {r['cases']} questions over {r['chunks']} chunks ({r['embedder']}, "
            f"{r['latency_ms_per_query']} ms/query)",
            "",
            "| config | recall@5 | hit@1 | MRR |",
            "|---|---|---|---|",
        ]
        for name in ("dense", "sparse", "hybrid", "hybrid_rerank"):
            if m := r.get(name):
                lines.append(f"| {name} | {m['recall@5']:.3f} | {m['hit@1']:.3f} | {m['mrr']:.3f} |")
        lines.append("")
    for suite in ("safety", "answers"):
        if s := report.get(suite):
            lines += [f"**{suite.title()}**", "", "| metric | value |", "|---|---|"]
            lines += [f"| {k} | {v} |" for k, v in s.items() if not isinstance(v, list)]
            lines += [f"- ⚠️ {f}" for f in s.get("failures", [])]
            lines.append("")
    if breaches:
        lines += ["❌ Threshold breaches:", *(f"- {b}" for b in breaches)]
    else:
        lines.append("✅ All thresholds met.")
    return "\n".join(lines)


async def run_suites(args: argparse.Namespace) -> dict[str, Any]:
    settings = get_settings()
    embedder: Embedder = (
        HashingEmbedder()
        if args.embedder == "hashing"
        else FastEmbedEmbedder(settings.embedding_model, settings.embedding_dim)
    )
    suites = set(args.suite.split(","))
    report: dict[str, Any] = {}
    if "retrieval" in suites:
        report["retrieval"] = await eval_retrieval(embedder, rerank=args.embedder != "hashing")
    if "safety" in suites:
        report["safety"] = eval_safety()
    if "answers" in suites:
        report["answers"] = await eval_answers(embedder)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--suite", default="retrieval,safety", help="comma-separated: retrieval,safety,answers")
    parser.add_argument("--embedder", choices=["fastembed", "hashing"], default="fastembed")
    parser.add_argument("--out", default="eval-report.json")
    parser.add_argument("--no-gate", action="store_true", help="report only; always exit 0")
    args = parser.parse_args()
    report = asyncio.run(run_suites(args))

    thresholds = yaml.safe_load((HERE / "thresholds.yaml").read_text())
    if args.embedder == "hashing":  # smoke mode: lexical embedder, not held to production floors
        thresholds.pop("retrieval", None)
    breaches = check_thresholds(report, thresholds)
    md = to_markdown(report, breaches)

    Path(args.out).write_text(json.dumps(report, indent=2))
    print(md)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary).open("a") as f:
            f.write(md + "\n")
    sys.exit(1 if breaches and not args.no_gate else 0)


if __name__ == "__main__":
    main()
