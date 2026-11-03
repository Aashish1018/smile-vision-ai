"""Public API contracts. The web client's TypeScript types are generated from the OpenAPI spec."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

from smileos.agents.care_plan import PlanDraft
from smileos.agents.catalog import CostEstimate
from smileos.db.models import CarePlan, Scan
from smileos.vision.schemas import Findings
from smileos.vision.scoring import Scores
from smileos.vision.triage import Triage


class Evidence(BaseModel):
    n: int
    chunk_id: str
    title: str
    heading: str
    text: str
    url: str | None = None


class PlanOut(BaseModel):
    id: uuid.UUID
    scan_id: uuid.UUID
    status: Literal["pending_review", "escalated", "approved", "rejected", "needs_retake"]
    draft: PlanDraft | None
    estimate: CostEstimate | None
    evidence: list[Evidence]
    path: list[str]
    review_notes: str | None
    updated_at: datetime

    @classmethod
    def of(cls, p: CarePlan) -> PlanOut:
        return cls(
            id=p.id,
            scan_id=p.scan_id,
            status=p.status,  # type: ignore[arg-type]
            draft=PlanDraft.model_validate(p.draft) if p.draft else None,
            estimate=CostEstimate.model_validate(p.estimate) if p.estimate else None,
            evidence=[Evidence.model_validate(e) for e in p.evidence],
            path=p.path,
            review_notes=p.review_notes,
            updated_at=p.updated_at,
        )


class ScanOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    clinic: str
    findings: Findings
    scores: Scores | None
    triage: Triage
    preview_available: bool
    share_token: str | None
    model_meta: dict[str, Any]
    plan: PlanOut | None

    @classmethod
    def of(cls, s: Scan, *, include_plan: bool = True) -> ScanOut:
        return cls(
            id=s.id,
            created_at=s.created_at,
            clinic=s.clinic_slug,
            findings=Findings.model_validate(s.findings),
            scores=Scores.model_validate(s.scores) if s.scores else None,
            triage=Triage.model_validate(s.triage),
            preview_available=s.preview_applied,
            share_token=s.share_token,
            model_meta=s.model_meta,
            plan=PlanOut.of(s.plan) if include_plan and s.plan else None,
        )


class SharedScanOut(BaseModel):
    """Deliberately minimal: no findings text, no identifiers beyond the opaque token."""

    clinic_name: str
    created_at: datetime
    scores: Scores | None


class ReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    notes: str | None = Field(default=None, max_length=2000)
    draft: PlanDraft | None = None


class ShareIn(BaseModel):
    enabled: bool
    consent: bool = Field(description="Owner confirms they consent to the before/after images being public.")


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    scan_id: uuid.UUID | None = None


class DevLoginIn(BaseModel):
    email: EmailStr
    role: Literal["patient", "dentist"] = "patient"
    clinic: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - OAuth token type, not a secret


class MeOut(BaseModel):
    sub: str
    role: Literal["patient", "dentist"]
    clinic: str | None


class ClinicOut(BaseModel):
    slug: str
    name: str
    currency: str


class TreatmentOut(BaseModel):
    code: str
    name: str
    unit: str
    duration: str


class SearchHit(BaseModel):
    chunk_id: str
    title: str
    heading: str
    text: str
    score: float
    dense_rank: int | None
    sparse_rank: int | None


class LLMOperationStats(BaseModel):
    operation: str
    model: str
    calls: int
    success_rate: float
    p50_ms: int
    p95_ms: int
    prompt_tokens: int
    completion_tokens: int
    avg_repairs: float


class MetricsOut(BaseModel):
    window_days: int
    llm: list[LLMOperationStats]
    triage: dict[str, int]
    plans: dict[str, int]
    preview_rate: float
