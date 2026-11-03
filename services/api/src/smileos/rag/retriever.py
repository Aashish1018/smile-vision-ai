"""Hybrid retrieval: dense + sparse candidates → reciprocal rank fusion → cross-encoder rerank.

Dense search handles paraphrase ("make my teeth whiter" ≈ "whitening"). Sparse search handles
exact terms the embedder underweights ("leukoplakia", "SRP"). RRF fuses the two rank lists
without score calibration. The cross-encoder then re-scores the short list by reading query and
chunk together, which is too slow for the whole corpus but much more precise.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from smileos.guardrails.injection import looks_like_injection
from smileos.rag.documents import Chunk
from smileos.rag.models import Embedder, Reranker
from smileos.rag.store import ChunkStore

RRF_K = 60


@dataclass(frozen=True, slots=True)
class Retrieved:
    chunk: Chunk
    score: float
    dense_rank: int | None
    sparse_rank: int | None


def reciprocal_rank_fusion(*rankings: Sequence[str], k: int = RRF_K) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


class HybridRetriever:
    def __init__(
        self,
        store: ChunkStore,
        embedder: Embedder,
        reranker: Reranker | None,
        *,
        candidates: int = 20,
    ) -> None:
        self.store = store
        self.embedder = embedder
        self.reranker = reranker
        self.candidates = candidates

    async def retrieve(self, query: str, k: int = 5) -> list[Retrieved]:
        dense = await self.store.vector_search(self.embedder.embed_query(query), self.candidates)
        sparse = await self.store.keyword_search(query, self.candidates)
        dense_ids = [i for i, _ in dense]
        sparse_ids = [i for i, _ in sparse]
        fused = reciprocal_rank_fusion(dense_ids, sparse_ids)[: self.candidates]

        chunks = await self.store.get([i for i, _ in fused])
        # Retrieved text is untrusted data: drop anything that tries to issue instructions.
        pool = [(cid, s) for cid, s in fused if cid in chunks and not looks_like_injection(chunks[cid].text)]

        if self.reranker and pool:
            scores = self.reranker.score(query, [chunks[cid].contextual_text for cid, _ in pool])
            pool = sorted(zip([cid for cid, _ in pool], scores, strict=True), key=lambda x: -x[1])

        def _rank(ids: list[str], cid: str) -> int | None:
            return ids.index(cid) + 1 if cid in ids else None

        return [
            Retrieved(chunk=chunks[cid], score=s, dense_rank=_rank(dense_ids, cid), sparse_rank=_rank(sparse_ids, cid))
            for cid, s in pool[:k]
        ]
