# 3. Postgres + pgvector with hybrid retrieval, not a dedicated vector DB

**Status:** accepted

## Context
The knowledge base is small (around 80 chunks today) but must support both paraphrased patient questions and exact
clinical terms. Scans, plans and agent checkpoints already need a relational store.

## Decision
One Postgres 17 instance: pgvector HNSW (cosine) for dense search, a generated `tsvector` column with GIN for
keyword search, reciprocal rank fusion to merge them, then a MiniLM cross-encoder over the top 20.
Chunks are split by section and embedded with a contextual header (`Article › Section`).

## Evidence
On 32 paraphrased questions: dense MRR 0.926, hybrid 0.925, hybrid + rerank 0.959 (recall@5 0.974).
Fusion alone didn't help on this paraphrase-heavy set. Reranking did. Sparse search is kept for exact
terms such as "leukoplakia" and "SRP".

## Consequences
- One datastore to back up and migrate (Alembic), with transactional consistency.
- At much larger scale, revisit HNSW parameters or move to a dedicated engine; the `ChunkStore` protocol
  isolates that change.
