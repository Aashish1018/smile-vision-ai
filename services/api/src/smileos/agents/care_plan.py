"""Care-plan agent: a LangGraph state machine with a human-in-the-loop approval step.

    START → gate ─┬─ retake ─────────────────────────────────────────→ END
                  ├─ see_dentist → escalate ──────────────┐
                  └─ routine → retrieve → draft ⇄ validate → estimate → review (interrupt) → END
                                                          └──────────┘

Only `draft` uses the LLM. Everything clinically load-bearing is deterministic code the model
can't override: triage gating, allowed treatment codes, citation checks, clinical sequencing
(stabilise → restore → align → whiten → cosmetic) and costs.
`validate` sends the draft back to `draft` with concrete errors, up to `MAX_DRAFTS` attempts.
`review` pauses the graph until a dentist approves, edits or rejects the plan.
"""

from __future__ import annotations

import operator
from dataclasses import dataclass
from typing import Annotated, Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from pydantic import BaseModel, Field

from smileos.agents.catalog import Catalog
from smileos.guardrails.safety import enforce_screening_language
from smileos.llm.client import ChatModel
from smileos.rag.retriever import HybridRetriever
from smileos.vision.schemas import Category, Findings
from smileos.vision.triage import Triage, TriageLevel

PLAN_PROMPT_VERSION = "care-plan-v2"
MAX_DRAFTS = 2
MIN_CONFIDENCE = 0.4

# Clinical sequencing: disease control before cosmetics; whitening before bonding/veneers so
# restorations can be shade-matched to the final tooth colour.
PHASE: dict[str, int] = {
    "EXAM": 0, "SPECIALIST_REFERRAL": 0,
    "CLEAN": 1, "SRP": 1,
    "FILLING": 2, "RCT": 2,
    "ALIGNERS": 3, "BRACES": 3,
    "WHITEN_OFFICE": 4, "WHITEN_HOME": 4,
    "BONDING": 5, "VENEER": 5, "CROWN": 5, "IMPLANT": 5, "BRIDGE": 5,
}  # fmt: skip


class PlanStep(BaseModel):
    code: str = Field(description="Treatment code from the allowed list.")
    quantity: int = Field(ge=1, le=32, description="Teeth, quadrants or courses, depending on the unit.")
    rationale: str = Field(max_length=300, description="Why, tied to a specific observation.")
    citations: list[int] = Field(description="Evidence numbers that support this step.")


class PlanDraft(BaseModel):
    steps: list[PlanStep] = Field(min_length=1, max_length=6)
    alternatives: list[PlanStep] = Field(default_factory=list, max_length=3)
    patient_summary: str = Field(max_length=900, description="Plain-language explanation for the patient.")


class CarePlanState(TypedDict, total=False):
    scan_id: str
    clinic: str
    findings: dict[str, Any]
    triage: dict[str, Any]
    evidence: list[dict[str, Any]]
    draft: dict[str, Any] | None
    errors: list[str]
    attempts: int
    estimate: dict[str, Any] | None
    review: dict[str, Any] | None
    status: str
    path: Annotated[list[str], operator.add]  # node trajectory, asserted on by evals


@dataclass
class AgentDeps:
    llm: ChatModel
    retriever: HybridRetriever
    catalog: Catalog


DRAFT_SYSTEM = """\
You draft dental care plans for a licensed dentist to review. Use only the allowed treatment
codes. Every step must cite the evidence numbers that support it. Prefer the least invasive
option that addresses the observation; put more invasive options under alternatives.
Never diagnose. The patient_summary must say the plan is a draft pending the dentist's review.
"""


def _observed(findings: Findings) -> set[Category]:
    return {o.category for o in findings.observations if o.confidence >= MIN_CONFIDENCE}


def _allowed_codes(catalog: Catalog, findings: Findings) -> list[str]:
    codes = {"EXAM", "CLEAN"} | {t.code for t in catalog.for_categories(_observed(findings))}
    codes.discard("SPECIALIST_REFERRAL")  # only the escalation path refers
    return sorted(codes, key=lambda c: (PHASE.get(c, 9), c))


def build_care_plan_graph(deps: AgentDeps, checkpointer: Any = None):
    catalog = deps.catalog

    def gate(state: CarePlanState) -> CarePlanState:
        return {"path": ["gate"], "attempts": 0, "errors": []}

    def route(state: CarePlanState) -> Literal["retake", "escalate", "retrieve"]:
        level = Triage.model_validate(state["triage"]).level
        if level == TriageLevel.RETAKE:
            return "retake"
        return "escalate" if level == TriageLevel.SEE_DENTIST else "retrieve"

    def retake(state: CarePlanState) -> CarePlanState:
        return {"path": ["retake"], "status": "needs_retake", "draft": None, "estimate": None}

    async def escalate(state: CarePlanState) -> CarePlanState:
        triage = Triage.model_validate(state["triage"])
        findings = Findings.model_validate(state["findings"])
        hits = await deps.retriever.retrieve("warning signs that need an in-person dental examination", k=3)
        evidence = [_evidence(n, h) for n, h in enumerate(hits, 1)]
        lesion = Category.SOFT_TISSUE_LESION in {o.category for o in findings.observations}
        steps = [PlanStep(code="EXAM", quantity=1, rationale=" ".join(triage.reasons), citations=[1])]
        if lesion:
            steps.append(
                PlanStep(
                    code="SPECIALIST_REFERRAL",
                    quantity=1,
                    rationale="A possible soft-tissue change was flagged; a clinician should examine it in person.",
                    citations=[1],
                )
            )
        draft = PlanDraft(
            steps=steps,
            patient_summary=(
                "Before discussing cosmetic options, we recommend an in-person examination. "
                + " ".join(triage.reasons)
                + " This is a draft pending your dentist's review."
            ),
        )
        return {"path": ["escalate"], "evidence": evidence, "draft": draft.model_dump(), "status": "escalated"}

    async def retrieve(state: CarePlanState) -> CarePlanState:
        findings = Findings.model_validate(state["findings"])
        queries = [
            f"treatment options for {o.category.value.replace('_', ' ')} on {o.location}"
            for o in findings.observations
            if o.confidence >= MIN_CONFIDENCE
        ] or ["everyday prevention and professional cleaning"]  # healthy smile: maintenance guidance
        seen: dict[str, Any] = {}
        for q in queries:
            for h in await deps.retriever.retrieve(q, k=3):
                seen.setdefault(h.chunk.id, h)
        evidence = [_evidence(n, h) for n, h in enumerate(list(seen.values())[:8], 1)]
        return {"path": ["retrieve"], "evidence": evidence}

    async def draft(state: CarePlanState) -> CarePlanState:
        findings = Findings.model_validate(state["findings"])
        allowed = _allowed_codes(catalog, findings)
        menu = "\n".join(f"- {c}: {catalog.treatments[c].name} (per {catalog.treatments[c].unit})" for c in allowed)
        observations = findings.describe(MIN_CONFIDENCE)
        evidence = "\n\n".join(f"[{e['n']}] {e['title']} › {e['heading']}\n{e['text']}" for e in state["evidence"])
        user = f"Observations:\n{observations}\n\nAllowed treatment codes:\n{menu}\n\nEvidence:\n{evidence}"
        if state.get("errors"):
            user += "\n\nYour previous draft was rejected for these reasons; fix them:\n" + "\n".join(
                f"- {e}" for e in state["errors"]
            )
        result = await deps.llm.structured(
            operation="care_plan.draft", system=DRAFT_SYSTEM, user=user, schema=PlanDraft
        )
        return {"path": ["draft"], "draft": result.model_dump(), "attempts": state.get("attempts", 0) + 1}

    def validate(state: CarePlanState) -> CarePlanState:
        findings = Findings.model_validate(state["findings"])
        allowed = set(_allowed_codes(catalog, findings))
        valid_refs = {e["n"] for e in state["evidence"]}
        plan = PlanDraft.model_validate(state["draft"])
        errors: list[str] = []

        def _clean(steps: list[PlanStep], label: str) -> list[PlanStep]:
            kept, seen = [], set()
            for s in steps:
                if s.code not in allowed:
                    errors.append(f"{label} uses code {s.code!r}, which is not in the allowed list.")
                    continue
                s.citations = [c for c in s.citations if c in valid_refs]
                if not s.citations:
                    errors.append(f"{label} step {s.code} has no valid evidence citation.")
                    continue
                if s.code not in seen:
                    seen.add(s.code)
                    kept.append(s)
            return kept

        plan.steps = sorted(_clean(plan.steps, "Plan"), key=lambda s: PHASE.get(s.code, 9))
        plan.alternatives = [
            a for a in _clean(plan.alternatives, "Alternative") if a.code not in {s.code for s in plan.steps}
        ]
        if not any(s.code == "EXAM" for s in plan.steps):
            plan.steps.insert(
                0,
                PlanStep(
                    code="EXAM",
                    quantity=1,
                    rationale="Confirm screening findings in person.",
                    citations=[min(valid_refs)],
                ),
            )
        plan.patient_summary, _ = enforce_screening_language(plan.patient_summary)

        # Ask for a redraft only if the errors removed every real treatment step.
        retry = len(plan.steps) <= 1 and errors and state.get("attempts", 0) < MAX_DRAFTS
        return {"path": ["validate"], "draft": plan.model_dump(), "errors": errors if retry else []}

    def after_validate(state: CarePlanState) -> Literal["draft", "estimate"]:
        return "draft" if state.get("errors") else "estimate"

    def estimate(state: CarePlanState) -> CarePlanState:
        plan = PlanDraft.model_validate(state["draft"])
        est = catalog.estimate(state["clinic"], [(s.code, s.quantity) for s in plan.steps])
        return {"path": ["estimate"], "estimate": est.model_dump(), "status": state.get("status") or "pending_review"}

    def review(state: CarePlanState) -> CarePlanState:
        decision = interrupt({"draft": state["draft"], "estimate": state["estimate"]})
        out: CarePlanState = {"path": ["review"], "review": decision}
        if decision.get("action") == "approve":
            out["status"] = "approved"
            if edited := decision.get("draft"):
                plan = PlanDraft.model_validate(edited)
                out["draft"] = plan.model_dump()
                out["estimate"] = catalog.estimate(
                    state["clinic"], [(s.code, s.quantity) for s in plan.steps]
                ).model_dump()
        else:
            out["status"] = "rejected"
        return out

    g = StateGraph(CarePlanState)
    for name, fn in [
        ("gate", gate), ("retake", retake), ("escalate", escalate), ("retrieve", retrieve),
        ("draft", draft), ("validate", validate), ("estimate", estimate), ("review", review),
    ]:  # fmt: skip
        g.add_node(name, fn)
    g.add_edge(START, "gate")
    g.add_conditional_edges("gate", route)
    g.add_edge("retake", END)
    g.add_edge("escalate", "estimate")
    g.add_edge("retrieve", "draft")
    g.add_edge("draft", "validate")
    g.add_conditional_edges("validate", after_validate)
    g.add_edge("estimate", "review")
    g.add_edge("review", END)
    return g.compile(checkpointer=checkpointer)


def _evidence(n: int, h) -> dict[str, Any]:
    c = h.chunk
    return {
        "n": n,
        "chunk_id": c.id,
        "title": c.doc_title,
        "heading": c.heading,
        "text": c.text,
        "url": c.sources[0].url if c.sources else None,
    }
