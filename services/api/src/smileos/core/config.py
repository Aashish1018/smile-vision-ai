"""Application settings, loaded from environment variables (and `.env` in development)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT = PACKAGE_ROOT.parents[1]


class LLMProvider(BaseSettings):
    """One OpenAI-compatible endpoint. Ollama, Groq, Gemini and OpenRouter all speak this protocol."""

    name: str
    base_url: str
    api_key: SecretStr = SecretStr("ollama")
    chat_model: str
    vision_model: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_nested_delimiter="__"
    )

    env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:5173"]

    database_url: str = "postgresql+asyncpg://smileos:smileos@localhost:5432/smileos"
    data_dir: Path = SERVICE_ROOT / "var"
    knowledge_dir: Path = SERVICE_ROOT / "knowledge"

    # --- Auth -------------------------------------------------------------
    # Supabase signs access tokens with asymmetric keys published at JWKS_URL.
    # JWT_SECRET covers legacy HS256 projects and the local dev-login flow.
    supabase_url: str | None = None
    jwt_secret: SecretStr = SecretStr("dev-only-insecure-secret-change-me-0123456789")
    jwt_audience: str = "authenticated"
    allow_dev_login: bool = False

    # --- Models -----------------------------------------------------------
    llm_providers: list[LLMProvider] = Field(
        default_factory=lambda: [
            LLMProvider(
                name="ollama",
                base_url="http://localhost:11434/v1",
                chat_model="gemma4:e4b",
                vision_model="gemma4:e4b",
            )
        ]
    )
    llm_timeout_s: float = 120.0
    llm_seed: int = 7
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    reranker_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    retrieval_candidates: int = 20
    retrieval_top_k: int = 5

    # --- Uploads ----------------------------------------------------------
    max_upload_bytes: int = 10 * 1024 * 1024
    max_image_side: int = 1280

    # --- Telemetry --------------------------------------------------------
    otel_exporter_otlp_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None

    @property
    def jwks_url(self) -> str | None:
        if not self.supabase_url:
            return None
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @model_validator(mode="after")
    def _guard_production(self) -> Settings:
        if self.env == "production":
            if self.allow_dev_login:
                raise ValueError("ALLOW_DEV_LOGIN must be false in production")
            if self.jwt_secret.get_secret_value().startswith("dev-only"):
                raise ValueError("JWT_SECRET must be set in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
