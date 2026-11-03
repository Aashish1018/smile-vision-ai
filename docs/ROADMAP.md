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
- [x] Fake random pipeline → real vision-LLM findings with structured output (`services/api/app/vision/`)
- [x] Seeded-random scores, plus score logic duplicated across client and server → a single deterministic, documented scoring module in the API
- [x] Mock data on Dashboard / Analysis / Share → real API data

### Security and privacy (this is health data)
- [x] Face photos went to a **public** bucket (`getPublicUrl`) → stored server-side and served only to their owner
- [x] Face images cached in `localStorage` → removed
- [x] `cors()` open to any origin → allow-list from settings
- [x] `debugMessage` leaked in production error payloads → typed error responses, details only in logs
- [x] No route guards and no backend auth → `<RequireAuth>` on the web side, JWT verification in FastAPI
- [x] API URL hard-coded to an HF Space → `VITE_API_URL`
- [x] PII sent to the LLM and traces → redaction guardrail before any model call

### Correctness
- [x] `deleteScan` never deleted (save only inserted missing rows) → a real `DELETE` endpoint
- [x] `saveScans` re-fetched every id on each save and swallowed insert errors → server-side persistence
- [x] `create policy if not exists` (invalid Postgres) in `supabase/schema.sql` → Alembic migrations
- [x] Duplicate `HF_API_TOKEN` in `.env.example`; Supabase silently fell back to placeholder credentials → validated settings

### Hygiene
- [x] Dead code removed: old landing page (`Index.tsx`, `Hero`, `Services`, `Technology`, `CTA`, root `Navbar`/`Footer`), `DashboardPage.tsx.orig`, `test_imports.py`, `capture.py`, `verify-hf.js`, `test-pipeline.js`, committed screenshot, duplicate `.Jules/` and `.jules/` folders, ~35 unused shadcn components, unused deps
- [x] Node 18 single-stage root Dockerfile using `npm install` against a pnpm lockfile → multi-stage, non-root, pinned images
- [x] Placeholder test only, Playwright pointed at a missing `e2e/` → real unit, integration, eval and e2e suites
- [x] Package named `vite_react_shadcn_ts@0.0.0` → `@smileos/web`

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
- [x] **1. Honest baseline:** remove the fake pipeline and mocks; fix the security and correctness findings
- [x] **2. FastAPI service:** settings, LLM provider layer, JWT auth, SSE, Alembic, compose
- [x] **3. Vision + preview:** structured findings, red-flag guard, masked whitening
- [x] **4. RAG:** ingestion CLI, hybrid retrieval + rerank, cited chat
- [x] **5. Agents:** LangGraph care-plan graph, human-in-the-loop approval, MCP server
- [x] **6. LLMOps:** eval harness, tracing, guardrails
- [x] **7. CI/CD:** workflows, hardened images
- [x] **8. Polish:** frontend on the real API, README, ADRs

## Deviations from the original plan
| Planned | Built | Why |
|---|---|---|
| LiteLLM router | Own OpenAI-compatible client with fallback + schema repair | Every target speaks the OpenAI protocol; fewer dependencies, smaller supply-chain surface (ADR 2) |
| Presidio PII redaction | Pattern-based redactor with the same interface | Deterministic, no spaCy model download; Presidio can be swapped in |
| Self-hosted Langfuse | Generic OTLP export (Jaeger profile in compose) + in-app metrics | Langfuse v3 needs ClickHouse/Redis/MinIO; OTLP works with Langfuse, Jaeger or Honeycomb unchanged |
| MediaPipe mouth landmarks | Lab-colour segmentation + lip connected components | No heavy CV dependency; declines when unsure. Limitations documented in the README |
| Dentist can edit drafts in the UI | API and agent support edited drafts; the UI offers approve/reject with notes | Scope; the edit path is covered by an agent test |
| Supabase Storage for photos | Private local/volume object store behind an `ObjectStore` protocol | Works offline; an S3/Supabase implementation would use signed URLs |

## Found and fixed by testing against reality
- The safety eval caught the diagnostic filter flagging hedged text ("...whether this is an infection").
- A real 3.8B model proposed two treatments for one gap; added least-invasive pruning (ADR 5).
- The Playwright journey exposed a sign-in race (navigating before the token was stored) in the test harness.
- nginx `add_header` inheritance would have dropped the CSP on every route; switched caching to `expires`.

## Decisions (see `docs/adr/`)
1. Python for the AI service, TypeScript for the web app.
2. Local-first models behind one OpenAI-compatible client.
3. Postgres + pgvector with hybrid retrieval instead of a dedicated vector DB.
4. Screening, not diagnosis.
5. Deterministic rails around the care-plan agent.
