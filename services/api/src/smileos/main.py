"""FastAPI application factory. Run with `uvicorn smileos.main:app`."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from smileos.api.routes import chat, clinic, misc, scans
from smileos.container import Container, ingest_knowledge
from smileos.core.config import Settings, get_settings
from smileos.core.errors import install_error_handlers
from smileos.core.logging import configure_logging, log
from smileos.observability.tracing import configure_tracing


def create_app(settings: Settings | None = None, container_factory=None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, json=settings.env != "development")
    configure_tracing(settings)
    container_factory = container_factory or (lambda: Container.open(settings))

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with container_factory() as container:
            if await container.store.count() == 0:
                await ingest_knowledge(container)
            app.state.container = container
            log.info("startup_complete", env=settings.env, providers=[p.name for p in settings.llm_providers])
            yield

    app = FastAPI(
        title="SmileOS API",
        version="0.1.0",
        summary="AI screening, grounded patient education and dentist-reviewed care plans.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    install_error_handlers(app)
    for r in (misc.router, scans.router, clinic.router, chat.router):
        app.include_router(r)
    return app


app = create_app() if __name__ != "__main__" and get_settings().env != "test" else None
