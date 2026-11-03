"""Dentist console: review queue, plan decisions, and LLM operations metrics."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import Integer, case, func, select

from smileos.api.deps import ContainerDep, PrincipalDep
from smileos.api.schemas import LLMOperationStats, MetricsOut, PlanOut, ReviewIn, ScanOut
from smileos.db.models import CarePlan, LLMCallRecord, Scan
from smileos.services import plans
from smileos.services.scans import require_dentist

router = APIRouter(prefix="/api/clinic", tags=["clinic"])


@router.get("/reviews", response_model=list[ScanOut])
async def review_queue(c: ContainerDep, principal: PrincipalDep) -> list[ScanOut]:
    pending = await plans.pending_reviews(c, principal)
    out = []
    for p in pending:
        scan = p.scan
        scan.plan = p
        out.append(ScanOut.of(scan))
    return out


@router.post("/plans/{plan_id}/review", response_model=PlanOut)
async def review(plan_id: uuid.UUID, body: ReviewIn, c: ContainerDep, principal: PrincipalDep) -> PlanOut:
    plan = await plans.review_plan(
        c, principal, plan_id, body.action, body.notes, body.draft.model_dump() if body.draft else None
    )
    return PlanOut.of(plan)


@router.get("/metrics", response_model=MetricsOut)
async def metrics(c: ContainerDep, principal: PrincipalDep) -> MetricsOut:
    """LLM latency, reliability, token use and repair rate, plus clinical funnel numbers."""
    clinic = require_dentist(principal)
    async with c.sessionmaker() as session:
        llm_rows = await session.execute(
            select(
                LLMCallRecord.operation,
                LLMCallRecord.model,
                func.count(),
                func.avg(LLMCallRecord.ok.cast(Integer)),
                func.percentile_cont(0.5).within_group(LLMCallRecord.latency_ms),
                func.percentile_cont(0.95).within_group(LLMCallRecord.latency_ms),
                func.coalesce(func.sum(LLMCallRecord.prompt_tokens), 0),
                func.coalesce(func.sum(LLMCallRecord.completion_tokens), 0),
                func.avg(LLMCallRecord.repairs),
            )
            .where(LLMCallRecord.created_at > func.now() - func.make_interval(0, 0, 0, 30))
            .group_by(LLMCallRecord.operation, LLMCallRecord.model)
        )
        level = Scan.triage["level"].astext
        triage_rows = await session.execute(
            select(level, func.count()).where(Scan.clinic_slug == clinic).group_by(level)
        )
        plan_rows = await session.execute(
            select(CarePlan.status, func.count()).join(Scan).where(Scan.clinic_slug == clinic).group_by(CarePlan.status)
        )
        preview_rate = (
            await session.execute(
                select(func.avg(case((Scan.preview_applied, 1.0), else_=0.0))).where(Scan.clinic_slug == clinic)
            )
        ).scalar()
    return MetricsOut(
        window_days=30,
        llm=[
            LLMOperationStats(
                operation=op,
                model=model,
                calls=n,
                success_rate=round(float(ok or 0), 3),
                p50_ms=int(p50 or 0),
                p95_ms=int(p95 or 0),
                prompt_tokens=int(pt or 0),
                completion_tokens=int(ct or 0),
                avg_repairs=round(float(rep or 0), 3),
            )
            for op, model, n, ok, p50, p95, pt, ct, rep in llm_rows
        ],
        triage=dict(triage_rows.tuples().all()),
        plans=dict(plan_rows.tuples().all()),
        preview_rate=round(float(preview_rate or 0), 3),
    )
