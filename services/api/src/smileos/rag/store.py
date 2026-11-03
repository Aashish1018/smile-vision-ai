"""Chunk stores. Both expose dense (vector) and sparse (keyword) search so retrieval can fuse them.

* `PgChunkStore`: pgvector HNSW index for cosine search plus Postgres full-text search
  (`websearch_to_tsquery` + `ts_rank_cd`) over a generated `tsvector` column.
* `MemoryChunkStore`: NumPy cosine plus Okapi BM25. Used by tests and the offline eval harness,
  and when no database is configured.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence
from typing import Protocol

import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from smileos.rag.documents import Chunk, Source

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = frozenset(
    [
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "can",
        "do",
        "does",
        "for",
        "from",
        "has",
        "have",
        "how",
        "i",
        "if",
        "in",
        "is",
        "it",
        "its",
        "my",
        "of",
        "on",
        "or",
        "should",
        "so",
        "that",
        "the",
        "this",
        "to",
        "was",
        "what",
        "when",
        "which",
        "who",
        "why",
        "will",
        "with",
        "you",
        "your",
    ]
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


class ChunkStore(Protocol):
    async def replace_all(self, chunks: Sequence[Chunk], embeddings: np.ndarray) -> None: ...
    async def vector_search(self, query_vec: np.ndarray, k: int) -> list[tuple[str, float]]: ...
    async def keyword_search(self, query: str, k: int) -> list[tuple[str, float]]: ...
    async def get(self, ids: Sequence[str]) -> dict[str, Chunk]: ...
    async def count(self) -> int: ...


class MemoryChunkStore:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self._chunks: list[Chunk] = []
        self._matrix = np.zeros((0, 0), dtype=np.float32)
        self._k1, self._b = k1, b

    async def replace_all(self, chunks: Sequence[Chunk], embeddings: np.ndarray) -> None:
        self._chunks = list(chunks)
        self._matrix = embeddings.astype(np.float32)
        self._tfs = [Counter(tokenize(c.contextual_text)) for c in self._chunks]
        self._lens = [sum(tf.values()) for tf in self._tfs]
        self._avg_len = (sum(self._lens) / len(self._lens)) if self._lens else 0.0
        df: Counter[str] = Counter()
        for tf in self._tfs:
            df.update(tf.keys())
        n = len(self._chunks)
        self._idf = {t: math.log(1 + (n - d + 0.5) / (d + 0.5)) for t, d in df.items()}

    async def vector_search(self, query_vec: np.ndarray, k: int) -> list[tuple[str, float]]:
        if not self._chunks:
            return []
        sims = self._matrix @ query_vec
        top = np.argsort(-sims)[:k]
        return [(self._chunks[i].id, float(sims[i])) for i in top]

    async def keyword_search(self, query: str, k: int) -> list[tuple[str, float]]:
        terms = tokenize(query)
        scores: list[tuple[str, float]] = []
        for chunk, tf, length in zip(self._chunks, self._tfs, self._lens, strict=True):
            s = 0.0
            for t in terms:
                if f := tf.get(t):
                    s += (
                        self._idf[t]
                        * f
                        * (self._k1 + 1)
                        / (f + self._k1 * (1 - self._b + self._b * length / self._avg_len))
                    )
            if s > 0:
                scores.append((chunk.id, s))
        return sorted(scores, key=lambda x: -x[1])[:k]

    async def get(self, ids: Sequence[str]) -> dict[str, Chunk]:
        wanted = set(ids)
        return {c.id: c for c in self._chunks if c.id in wanted}

    async def count(self) -> int:
        return len(self._chunks)


class PgChunkStore:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def replace_all(self, chunks: Sequence[Chunk], embeddings: np.ndarray) -> None:
        from smileos.db.models import KnowledgeChunk

        async with self._sm.begin() as session:
            await session.execute(delete(KnowledgeChunk))
            session.add_all(
                KnowledgeChunk(
                    id=c.id,
                    doc_slug=c.doc_slug,
                    doc_title=c.doc_title,
                    heading=c.heading,
                    ordinal=c.ordinal,
                    content=c.text,
                    contextual_content=c.contextual_text,
                    sources=[{"label": s.label, "url": s.url} for s in c.sources],
                    embedding=emb.tolist(),
                )
                for c, emb in zip(chunks, embeddings, strict=True)
            )

    async def vector_search(self, query_vec: np.ndarray, k: int) -> list[tuple[str, float]]:
        from smileos.db.models import KnowledgeChunk

        distance = KnowledgeChunk.embedding.cosine_distance(query_vec.tolist())
        async with self._sm() as session:
            rows = await session.execute(select(KnowledgeChunk.id, distance).order_by(distance).limit(k))
            return [(rid, 1.0 - float(d)) for rid, d in rows]

    async def keyword_search(self, query: str, k: int) -> list[tuple[str, float]]:
        # OR the terms so partial matches still rank; ts_rank_cd rewards proximity and coverage.
        terms = " | ".join(tokenize(query))
        if not terms:
            return []
        sql = text(
            "SELECT id, ts_rank_cd(tsv, q) AS score FROM knowledge_chunks, to_tsquery('english', :q) q "
            "WHERE tsv @@ q ORDER BY score DESC LIMIT :k"
        )
        async with self._sm() as session:
            rows = await session.execute(sql, {"q": terms, "k": k})
            return [(rid, float(score)) for rid, score in rows]

    async def get(self, ids: Sequence[str]) -> dict[str, Chunk]:
        from smileos.db.models import KnowledgeChunk

        async with self._sm() as session:
            rows = (await session.execute(select(KnowledgeChunk).where(KnowledgeChunk.id.in_(ids)))).scalars()
            return {
                r.id: Chunk(
                    id=r.id,
                    doc_slug=r.doc_slug,
                    doc_title=r.doc_title,
                    heading=r.heading,
                    text=r.content,
                    ordinal=r.ordinal,
                    sources=tuple(Source(s["label"], s.get("url")) for s in r.sources),
                )
                for r in rows
            }

    async def count(self) -> int:
        async with self._sm() as session:
            return int((await session.execute(text("SELECT count(*) FROM knowledge_chunks"))).scalar_one())
