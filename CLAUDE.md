# CLAUDE.md

Guidance for AI coding agents (and humans) working in this repo. The rebuild plan and review findings are in
`docs/ROADMAP.md`; design decisions are in `docs/adr/`.

## What this is
SmileOS: a dental clinic copilot. A patient uploads a smile photo. A vision LLM returns structured *screening*
findings, and deterministic code turns them into scores, triage and a teeth-only whitening preview. A LangGraph
agent drafts a cited, costed care plan that pauses until a dentist approves it. Patients can ask grounded
questions answered by hybrid RAG over a curated knowledge base.

## Layout
```
apps/web/           React 18 + Vite + TS + shadcn/ui (pnpm)
services/api/       FastAPI + Python 3.12 (uv)
  src/smileos/
    api/            routes, request/response schemas, deps (auth, rate limits)
    services/       use-cases shared by REST and MCP (scans, plans)
    vision/         findings schema + prompt, scoring, triage, screening pipeline
    imaging/        upload normalization, teeth-mask whitening
    rag/            documents/chunking, embedder + reranker, stores, hybrid retriever, grounded answers
    agents/         care-plan LangGraph, treatment catalog + price sheets
    guardrails/     PII redaction, diagnostic-language filter, injection screening
    llm/            OpenAI-compatible client with provider fallback + schema repair
    mcp/            MCP server over the same services
    container.py    composition root (the one place dependencies are wired)
  knowledge/        markdown articles + catalog.yaml (treatments, clinic prices)
  evals/            datasets, thresholds, runner
  alembic/          migrations
compose.yaml        db (pgvector) + api + web, optional ollama/jaeger profiles
```

## Commands
```bash
docker compose up -d db                                   # Postgres + pgvector on :5432
cd services/api
uv sync                                                   # install
uv run alembic upgrade head                               # migrate
uv run uvicorn smileos.main:app --reload                  # API on :8000 (docs at /docs)
uv run ruff check . && uv run ruff format --check . && uv run pyright
uv run pytest                                             # unit tests (no DB needed)
TEST_DATABASE_URL=postgresql+asyncpg://smileos:smileos@localhost:5432/smileos_test uv run pytest   # + API tests
uv run python -m evals.run                                # retrieval + safety evals (gates CI)
uv run python -m evals.run --suite answers                # LLM-judged answers (needs Ollama)

cd apps/web
pnpm install && pnpm dev                                  # web on :5173
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm gen:api                                              # regenerate src/lib/api-types.ts from the running API
```

## Rules that matter
- **Screening, not diagnosis.** Never add code or prompts that state a user *has* a condition. Model text passes
  through `guardrails/safety.py`. Escalation is decided by rules in `vision/triage.py`, not by the LLM.
- **Clinically load-bearing logic is deterministic.** Allowed treatment codes, sequencing, citations and costs are
  enforced in `agents/care_plan.py` (`validate`, `estimate`). The LLM only drafts.
- **No fabricated data.** Scores derive from findings (`vision/scoring.py`), costs from `knowledge/catalog.yaml`.
  If something isn't real yet, the UI must say so.
- **Patient photos are private.** Served only through authorised routes; uploads are re-encoded, which strips EXIF.
- **Prompt changes bump the version constant** (`FINDINGS_PROMPT_VERSION`, `ANSWER_PROMPT_VERSION`,
  `PLAN_PROMPT_VERSION`) and should come with an eval run.
- New dependencies go in `container.py`; routes and the MCP server call `services/*`, never each other.
- Tests use `FakeChatModel` and `HashingEmbedder` (see `tests/conftest.py`). Don't hit real models in unit tests.
- Python: ruff (line length 120) and pyright must pass. TS: ESLint and `tsc` must pass.
