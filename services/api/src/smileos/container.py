"""Composition root: builds every long-lived dependency once per process.

The API (FastAPI lifespan), the MCP server and the CLIs all start from `Container.open()`,
so they share exactly the same wiring.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from smileos.agents.care_plan import AgentDeps, build_care_plan_graph
from smileos.agents.catalog import Catalog, load_catalog
from smileos.core.config import Settings
from smileos.core.logging import log
from smileos.core.security import TokenVerifier
from smileos.db.session import DbUsageRecorder, make_engine, make_sessionmaker
from smileos.llm.client import ChatModel, OpenAICompatChatModel
from smileos.rag.documents import chunk_document, load_documents
from smileos.rag.models import Embedder, FastEmbedEmbedder, FastEmbedReranker, Reranker
from smileos.rag.retriever import HybridRetriever
from smileos.rag.store import ChunkStore, PgChunkStore
from smileos.storage.objects import LocalObjectStore, ObjectStore


@dataclass
class Container:
    settings: Settings
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]
    llm: ChatModel
    embedder: Embedder
    store: ChunkStore
    retriever: HybridRetriever
    catalog: Catalog
    objects: ObjectStore
    verifier: TokenVerifier
    care_plan_graph: Any

    @classmethod
    @asynccontextmanager
    async def open(
        cls,
        settings: Settings,
        *,
        llm: ChatModel | None = None,
        embedder: Embedder | None = None,
        reranker: Reranker | Literal["default"] | None = "default",
    ) -> AsyncIterator[Container]:
        """Overrides exist for tests: inject a scripted LLM or a deterministic embedder."""
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        engine = make_engine(settings.database_url)
        sm = make_sessionmaker(engine)
        llm = llm or OpenAICompatChatModel(settings, DbUsageRecorder(sm))
        embedder = embedder or FastEmbedEmbedder(settings.embedding_model, settings.embedding_dim)
        if reranker == "default":
            reranker = FastEmbedReranker(settings.reranker_model)
        store = PgChunkStore(sm)
        retriever = HybridRetriever(store, embedder, reranker, candidates=settings.retrieval_candidates)
        catalog = load_catalog(settings.knowledge_dir / "catalog.yaml")
        psycopg_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        async with AsyncPostgresSaver.from_conn_string(psycopg_url) as checkpointer:
            await checkpointer.setup()
            graph = build_care_plan_graph(AgentDeps(llm=llm, retriever=retriever, catalog=catalog), checkpointer)
            try:
                yield cls(
                    settings=settings,
                    engine=engine,
                    sessionmaker=sm,
                    llm=llm,
                    embedder=embedder,
                    store=store,
                    retriever=retriever,
                    catalog=catalog,
                    objects=LocalObjectStore(settings.data_dir / "objects"),
                    verifier=TokenVerifier(settings),
                    care_plan_graph=graph,
                )
            finally:
                await engine.dispose()


async def ingest_knowledge(container: Container) -> int:
    docs = load_documents(container.settings.knowledge_dir / "articles")
    chunks = [c for d in docs for c in chunk_document(d)]
    embeddings = container.embedder.embed_documents([c.contextual_text for c in chunks])
    await container.store.replace_all(chunks, embeddings)
    log.info("knowledge_ingested", documents=len(docs), chunks=len(chunks))
    return len(chunks)
