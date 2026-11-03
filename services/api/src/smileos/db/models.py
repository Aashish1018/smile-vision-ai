"""Relational schema. Postgres 16 with pgvector; migrations live in `alembic/`."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, ClassVar

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, Computed, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

EMBEDDING_DIM = 384


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {dict[str, Any]: JSONB, list[Any]: JSONB}


class Profile(Base):
    """App-level role for an auth subject. Patients see their own scans; dentists see their clinic's queue."""

    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default="patient")
    clinic_slug: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    clinic_slug: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    original_key: Mapped[str] = mapped_column(String(256))
    preview_key: Mapped[str | None] = mapped_column(String(256))
    preview_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    findings: Mapped[dict[str, Any]]
    scores: Mapped[dict[str, Any] | None]
    triage: Mapped[dict[str, Any]]
    model_meta: Mapped[dict[str, Any]]
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    shared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    plan: Mapped[CarePlan | None] = relationship(back_populates="scan", cascade="all, delete-orphan", uselist=False)


class CarePlan(Base):
    __tablename__ = "care_plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), unique=True)
    thread_id: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), index=True)
    draft: Mapped[dict[str, Any] | None]
    estimate: Mapped[dict[str, Any] | None]
    evidence: Mapped[list[Any]] = mapped_column(default=list)
    path: Mapped[list[Any]] = mapped_column(default=list)
    reviewer_id: Mapped[str | None] = mapped_column(String(64))
    review_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    scan: Mapped[Scan] = relationship(back_populates="plan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    doc_slug: Mapped[str] = mapped_column(String(96), index=True)
    doc_title: Mapped[str] = mapped_column(String(200))
    heading: Mapped[str] = mapped_column(String(200))
    ordinal: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    contextual_content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list[Any]] = mapped_column(default=list)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    tsv: Mapped[Any] = mapped_column(TSVECTOR, Computed("to_tsvector('english', contextual_content)", persisted=True))

    __table_args__ = (
        Index(
            "ix_knowledge_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_knowledge_chunks_tsv", "tsv", postgresql_using="gin"),
    )


class LLMCallRecord(Base):
    __tablename__ = "llm_calls"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    operation: Mapped[str] = mapped_column(String(64), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(96))
    latency_ms: Mapped[int] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    repairs: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
