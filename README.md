# SmileOS

**An AI copilot for dental clinics.** A patient uploads a smile photo. A vision LLM returns structured
screening findings, deterministic code turns them into scores, triage and a teeth-only whitening
preview, and a LangGraph agent drafts a **cited, costed care plan that waits for a dentist's
approval**. Patients can ask follow-up questions answered by hybrid RAG over a curated, sourced
knowledge base.

Built local-first: everything runs on your machine with Ollama, with no API keys and no GPU required for
the stub-backed demo.

![CI](https://img.shields.io/badge/CI-lint%20·%20types%20·%20tests%20·%20evals%20·%20e2e-6f9a6c)
![Python](https://img.shields.io/badge/python-3.12-3776AB)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6)

---

## Why it's built this way

Dental treatment is expensive and hard to picture, so patients hesitate and clinics struggle to earn
trust before the first visit. An LLM can help explain options, but in healthcare **a confident wrong
answer is worse than no answer**. So the core design rule is:

> The model drafts; deterministic code decides anything clinically load-bearing.

| Concern | Who decides | Where |
|---|---|---|
| What's visible in the photo | Vision LLM (structured output, confidence per finding) | `vision/` |
| Whether to escalate to an in-person exam | **Rules**, with a low threshold for possible lesions | `vision/triage.py` |
| Which treatments may be proposed | **Closed catalog**, filtered by findings | `agents/catalog.py` |
| Treatment order (stabilise → restore → align → whiten → cosmetic) | **Code** | `agents/care_plan.py` |
| Two treatments for the same problem | **Least-invasive set cover**; the extra one becomes an alternative | `agents/care_plan.py` |
| Every plan step is backed by a source | **Validator**; uncited steps are dropped or sent back for a redraft | `agents/care_plan.py` |
| Cost | **Clinic price sheet**, never the model | `knowledge/catalog.yaml` |
| Final say | **The dentist** (graph interrupt + resume) | `services/plans.py` |
| Diagnostic wording ("you have…") | **Guardrail** rewrites it to screening language | `guardrails/safety.py` |

## Architecture

```mermaid
flowchart LR
  subgraph Web["apps/web · React + TS"]
    P[Patient app] --- D[Dentist console]
  end
  subgraph API["services/api · FastAPI"]
    R[REST + SSE] --> S[services]
    M[MCP server] --> S
    S --> V[Vision screening<br/>structured output]
    S --> I[Teeth-mask<br/>whitening]
    S --> G[LangGraph<br/>care-plan agent]
    S --> Q[Grounded chat]
    G --> H[Hybrid retriever]
    Q --> H
    V & G & Q --> L[LLM client<br/>fallback + schema repair]
    GR[Guardrails<br/>PII · diagnosis · injection] -.-> Q & G & V
  end
  L --> O[(Ollama / any<br/>OpenAI-compatible API)]
  H --> PG[(Postgres 17<br/>pgvector HNSW + FTS)]
  G --> CK[(LangGraph checkpoints)]
  API --> OT[OpenTelemetry → Jaeger / Langfuse]
  Web -- bearer JWT --> R
```

**Care-plan agent** (LangGraph state machine, checkpointed in Postgres so a review can resume days later):

```mermaid
stateDiagram-v2
  [*] --> gate
  gate --> retake: poor photo
  gate --> escalate: possible lesion / decay
  gate --> retrieve: routine
  retrieve --> draft: evidence
  draft --> validate
  validate --> draft: invalid codes / uncited (≤2 attempts)
  validate --> estimate
  escalate --> estimate
  estimate --> review: interrupt()
  review --> [*]: dentist approves / rejects
  retake --> [*]
```

## Highlights

- **Vision screening with an honest contract.** Closed-vocabulary findings, per-observation confidence, and a
  mandatory image-quality gate, so a bad photo gets "please retake" instead of invented findings.
  Temperature 0 with a fixed seed, so the same photo gets the same result (the old prototype picked one of six
  canned reports at random).
- **Hybrid RAG done properly.** Heading-aware chunks with contextual headers → `bge-small` embeddings
  (pgvector HNSW) plus Postgres full-text search → reciprocal rank fusion → MiniLM cross-encoder rerank →
  numbered citations. Retrieved text is screened for prompt injection before it reaches the model.
- **Agent with human-in-the-loop.** LangGraph graph with a validator→redraft loop and an `interrupt()` for
  dentist approval. Agent trajectories are asserted in tests. Against a real 3.8B model, the draft proposed
  aligners *and* bonding for one small gap (₹88,500–272,000). The least-invasive rule moved aligners to
  alternatives (₹16,500–43,000), and a regression test now pins it ([ADR 5](docs/adr/0005-deterministic-rails-around-the-agent.md)).
- **Streaming everywhere.** Upload progress and chat tokens stream over SSE. If a post-stream guardrail rewrites
  the answer, a `replace` event corrects the UI.
- **LLMOps.** Eval harness with CI gates, OpenTelemetry spans with GenAI attributes, per-call usage records
  (latency, tokens, schema-repair rate), and an in-app metrics dashboard.
- **MCP server.** The clinic tools (`search_knowledge`, `estimate_cost`, `pending_reviews`,
  `review_care_plan`) are exposed to any MCP client, such as Claude Desktop or IDE agents, through the same
  service layer as the REST API.
- **Privacy by default.** Photos are re-encoded (EXIF/GPS stripped), stored privately, and served only to
  their owner or their clinic. PII is redacted before any model call. Share links are opt-in, need explicit
  consent, expose only images and scores, and can be revoked.
- **Production hygiene.** Strict typing (pyright, TS `strict`), 65 backend tests at 92% coverage, a Playwright
  journey test, Alembic migrations, multi-stage non-root images with baked-in model weights, SBOM and
  provenance attestations, CodeQL and Dependabot.

## Evaluation

`uv run python -m evals.run`. Retrieval is measured on 32 patient-phrased questions with no title-word
overlap, over 79 chunks, at the document level:

| Retriever | Recall@5 | Hit@1 | MRR |
|---|---|---|---|
| Dense (bge-small) | 0.969 | 0.906 | 0.926 |
| Sparse (BM25) | 0.854 | 0.844 | 0.878 |
| Hybrid (RRF) | 0.927 | 0.875 | 0.925 |
| **Hybrid + cross-encoder rerank** | **0.974** | **0.938** | **0.959** |

Plain RRF slightly *underperforms* dense-only on this paraphrase-heavy set, because BM25 adds noise when
patients don't use clinical terms. Reranking recovers it and wins on every metric. Sparse search still earns
its place on exact-term queries ("leukoplakia", "SRP").

Safety suite (deterministic, gated at 100%): triage escalation recall, the diagnostic-language filter, and
injection detection. The first run caught a real false positive ("...whether this is an infection"), now fixed
and covered by a regression test.

Answer quality (LLM-as-judge, nightly, not gated): with `phi3` (3.8B) answering *and* judging locally,
faithfulness was 0.63 and citation coverage 0.71. A small model judging itself is noisy. Point the nightly job
at a stronger model to get a signal worth gating on.

## Quickstart

**Requirements:** Docker. Optionally [Ollama](https://ollama.com) for real model output.

```bash
# Deterministic demo with a stub LLM (no model download):
docker compose -f compose.yaml -f compose.e2e.yaml up --build
# Real local models: pull a small vision model, then start the default stack
ollama pull gemma3:4b
docker compose up --build
```

Open http://localhost:5173 and sign in with any email (demo mode). Choose **Dentist** to see the review queue
and metrics. If port 8000 or 5173 is taken: `API_PORT=8001 WEB_PORT=5174 docker compose up`.

### Local development

```bash
docker compose up -d db
cd services/api && cp .env.example .env && uv sync && uv run alembic upgrade head
uv run uvicorn smileos.main:app --reload          # http://localhost:8000/docs
cd apps/web && cp .env.example .env && pnpm install && pnpm dev
```

| Task | Command |
|---|---|
| API checks | `uv run ruff check . && uv run pyright && uv run pytest` |
| API + DB integration tests | `TEST_DATABASE_URL=postgresql+asyncpg://smileos:smileos@localhost:5432/smileos_test uv run pytest` |
| Evals | `uv run python -m evals.run` (`--suite answers` for LLM-judged) |
| Web checks | `pnpm lint && pnpm typecheck && pnpm test` |
| E2E | `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e` |
| Regenerate API types | `uv run python -m smileos.openapi > ../../apps/web/openapi.json && pnpm gen:api` |
| MCP server | `uv run smileos-mcp` (stdio) or `--http` |
| Re-index knowledge | `uv run smileos-ingest` |

## Repository layout

```
apps/web/              React 18 · Vite · TypeScript (strict) · TanStack Query · shadcn/ui
services/api/          FastAPI · Python 3.12 · uv · Pydantic v2 · SQLAlchemy 2 · Alembic
  src/smileos/         api · services · vision · imaging · rag · agents · guardrails · llm · mcp
  knowledge/           15 sourced patient-education articles + treatment catalog & clinic price sheets
  evals/               datasets, thresholds, runner
  tests/               unit, agent, LLM-client, API integration, stub LLM for e2e
docs/                  ROADMAP.md (review + rebuild log) · adr/ (design decisions)
.github/workflows/     ci · nightly-evals · release · codeql
```

## Known limitations

- **The whitening preview is classical segmentation** (Lab colour thresholds plus lip-region connected
  components). It works on clear frontal and profile smiles and declines when unsure, but it can leak onto
  bright backgrounds in profile shots. It only simulates whitening, not orthodontic or restorative outcomes.
- **Findings are only as good as the vision model.** Small local models miss subtle issues; that's why
  everything is framed as screening, with low escalation thresholds and dentist review.
- **The knowledge base is a curated set of summaries** written for this project, citing NHS, NIDCR, ADA, AAO and
  AAP pages. It is not a clinical guideline corpus.
- The rate limiter is in-process (single replica). Swap in Redis to run several replicas.

## Not a medical device

SmileOS is a portfolio project. It does not diagnose, and it is not a substitute for professional dental care.
