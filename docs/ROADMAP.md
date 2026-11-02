# SmileOS Rebuild Roadmap

This file tracks the rebuild from the original "DentalVision" prototype into **SmileOS**, an agentic RAG copilot for dental clinics. It records what was wrong, what changes, and why.

## Why a rebuild

The prototype looked finished but its core was fake:

| Where | What it actually did |
|---|---|
| `server/services/teethPipeline.js` | The "AI simulation" applied a global brightness/saturation filter to the whole photo, face included. The report was one of six hard-coded scenarios picked with `Math.random()`. `segmentConfidence: 0.95` was a constant. |
| `src/lib/scanStorage.ts` | "Scores" came from a hash of the file size and pixel dimensions. |
| `src/data/mock*.ts` | Dashboard, analysis and share pages rendered static mock data. |

The same photo uploaded twice gave different diagnoses. The rebuild replaces this with a real, inspectable pipeline that admits uncertainty.

## Code review findings

### Integrity
- [ ] Fake random pipeline → real vision-LLM findings with structured output (`services/api/app/vision/`)
- [ ] Seeded-random scores, plus score logic duplicated across client and server → a single deterministic, documented scoring module in the API
- [ ] Mock data on Dashboard / Analysis / Share → real API data

### Security and privacy (this is health data)
- [ ] Face photos went to a **public** bucket (`getPublicUrl`) → stored server-side and served only to their owner
- [ ] Face images cached in `localStorage` → removed
- [ ] `cors()` open to any origin → allow-list from settings
- [ ] `debugMessage` leaked in production error payloads → typed error responses, details only in logs
- [ ] No route guards and no backend auth → `<RequireAuth>` on the web side, JWT verification in FastAPI
- [ ] API URL hard-coded to an HF Space → `VITE_API_URL`
- [ ] PII sent to the LLM and traces → redaction guardrail before any model call

### Correctness
- [ ] `deleteScan` never deleted (save only inserted missing rows) → a real `DELETE` endpoint
- [ ] `saveScans` re-fetched every id on each save and swallowed insert errors → server-side persistence
- [ ] `create policy if not exists` (invalid Postgres) in `supabase/schema.sql` → Alembic migrations
- [ ] Duplicate `HF_API_TOKEN` in `.env.example`; Supabase silently fell back to placeholder credentials → validated settings

### Hygiene
- [ ] Dead code removed: old landing page (`Index.tsx`, `Hero`, `Services`, `Technology`, `CTA`, root `Navbar`/`Footer`), `DashboardPage.tsx.orig`, `test_imports.py`, `capture.py`, `verify-hf.js`, `test-pipeline.js`, committed screenshot, duplicate `.Jules/` and `.jules/` folders, ~35 unused shadcn components, unused deps
- [ ] Node 18 single-stage root Dockerfile using `npm install` against a pnpm lockfile → multi-stage, non-root, pinned images
- [ ] Placeholder test only, Playwright pointed at a missing `e2e/` → real unit, integration, eval and e2e suites
- [ ] Package named `vite_react_shadcn_ts@0.0.0` → `@smileos/web`

## Target architecture

```
apps/web/          React 18 + Vite + TS + shadcn/ui, TanStack Query
services/api/      FastAPI · Python 3.12 · uv · Pydantic v2 · SQLAlchemy 2 + Alembic
  app/llm/         provider layer: Ollama (default, local) → any OpenAI-compatible host as fallback
  app/vision/      structured screening findings from a vision LLM + deterministic scoring
  app/imaging/     smile preview: whitening restricted to a detected tooth mask
  app/rag/         ingestion → chunking → fastembed embeddings → pgvector + Postgres FTS → RRF fusion → cross-encoder rerank → citations
  app/agents/      LangGraph care-plan graph with a dentist-approval interrupt
  app/guardrails/  PII redaction, red-flag escalation, medical-claim filter, injection screening
  app/mcp/         MCP server exposing the clinic tools
evals/             golden datasets + metrics; gates CI
infra/             docker compose (postgres+pgvector, api, web, optional langfuse)
.github/workflows/ ci, evals, release
```

## Phases

- [x] **0. Scaffold:** `CLAUDE.md`, this roadmap, monorepo layout, dead-code purge
- [ ] **1. Honest baseline:** remove the fake pipeline and mocks; fix the security and correctness findings
- [ ] **2. FastAPI service:** settings, LLM provider layer, JWT auth, SSE, Alembic, compose
- [ ] **3. Vision + preview:** structured findings, red-flag guard, masked whitening
- [ ] **4. RAG:** ingestion CLI, hybrid retrieval + rerank, cited chat
- [ ] **5. Agents:** LangGraph care-plan graph, human-in-the-loop approval, MCP server
- [ ] **6. LLMOps:** eval harness, tracing, guardrails
- [ ] **7. CI/CD:** workflows, hardened images
- [ ] **8. Polish:** frontend on the real API, README, ADRs

## Decisions (see `docs/adr/`)
1. Python for the AI service, TypeScript for the web app.
2. Local-first models (Ollama) behind an OpenAI-compatible interface, so the demo costs nothing and hosts can be swapped.
3. Postgres + pgvector instead of a dedicated vector DB: one datastore, transactional, with hybrid search built in.
4. Screening, not diagnosis: the system never names a disease. Red flags escalate to a professional.
