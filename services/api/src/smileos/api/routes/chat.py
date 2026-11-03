from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sse_starlette import EventSourceResponse

from smileos.api.deps import ContainerDep, RateLimiter
from smileos.api.schemas import ChatIn, SearchHit
from smileos.core.errors import AppError
from smileos.core.logging import log
from smileos.core.security import Principal
from smileos.rag.answer import answer_stream
from smileos.services.scans import get_scan
from smileos.vision.schemas import Findings

router = APIRouter(prefix="/api", tags=["knowledge"])
chat_limit = RateLimiter(limit=60, window_s=3600)


@router.post("/chat", summary="Ask a question; answer streams with citations")
async def chat(
    body: ChatIn, c: ContainerDep, principal: Annotated[Principal, Depends(chat_limit)]
) -> EventSourceResponse:
    scan_context = None
    if body.scan_id:
        scan = await get_scan(c, principal, body.scan_id)
        scan_context = Findings.model_validate(scan.findings).describe()

    async def events():
        try:
            async for event, payload in answer_stream(
                question=body.question,
                history=[t.model_dump() for t in body.history],
                retriever=c.retriever,
                llm=c.llm,
                scan_context=scan_context,
                top_k=c.settings.retrieval_top_k,
            ):
                yield {"event": event, "data": json.dumps(payload)}
        except AppError as exc:
            yield {"event": "error", "data": json.dumps({"code": exc.code, "message": exc.public_message})}
        except Exception:
            log.exception("chat_crashed")
            yield {"event": "error", "data": json.dumps({"code": "internal_error", "message": AppError.public_message})}

    return EventSourceResponse(events(), ping=15)


@router.get("/knowledge/search", response_model=list[SearchHit], summary="Inspect hybrid retrieval for a query")
async def search(
    c: ContainerDep, q: Annotated[str, Query(min_length=2, max_length=300)], k: int = 5
) -> list[SearchHit]:
    hits = await c.retriever.retrieve(q, k=min(k, 10))
    return [
        SearchHit(
            chunk_id=h.chunk.id,
            title=h.chunk.doc_title,
            heading=h.chunk.heading,
            text=h.chunk.text,
            score=h.score,
            dense_rank=h.dense_rank,
            sparse_rank=h.sparse_rank,
        )
        for h in hits
    ]
