from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from smileos.db.models import LLMCallRecord
from smileos.observability.usage import LLMCall


def make_engine(url: str) -> AsyncEngine:
    return create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


class DbUsageRecorder:
    """Persists LLM call records for the metrics endpoint. Failures never break a request."""

    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def record(self, call: LLMCall) -> None:
        from smileos.core.logging import log

        try:
            async with self._sm.begin() as session:
                session.add(LLMCallRecord(**call.as_dict()))
        except Exception as exc:
            log.warning("usage_record_failed", error=str(exc))
