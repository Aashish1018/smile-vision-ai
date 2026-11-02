# syntax=docker/dockerfile:1.7
# Multi-stage build: uv resolves the locked environment in a builder; the runtime image holds
# only the virtualenv, source and pre-downloaded ONNX models, and runs as a non-root user.

FROM python:3.12-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

# Bake the embedding and reranker weights into the image so cold starts don't hit the network.
ENV FASTEMBED_CACHE_PATH=/app/models
RUN /app/.venv/bin/python -c "\
from fastembed import TextEmbedding; from fastembed.rerank.cross_encoder import TextCrossEncoder; \
from smileos.core.config import Settings; s = Settings(); \
TextEmbedding(s.embedding_model); TextCrossEncoder(s.reranker_model)"

FROM python:3.12-slim-bookworm AS runtime
RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/app/models \
    DATA_DIR=/app/var \
    ENV=production
RUN mkdir -p /app/var && chown app:app /app/var
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn smileos.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
