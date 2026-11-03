"""Care-plan orchestration: run the agent graph to its review interrupt, persist the draft, and
resume it when a dentist decides. The graph checkpoint lives in Postgres, keyed by `thread_id`,
so a review can arrive days later or on a different replica.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from langgraph.types import Command
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from smileos.agents.care_plan import PlanDraft
from smileos.container import Container
from smileos.core.errors import BadRequest, Conflict, NotFound
from smileos.core.security import Principal
from smileos.db.models import CarePlan, Scan
from smileos.services.scans import get_scan, require_dentist


def _config(thread_id: str) -> dict[str, Any]:
    return {"configurable": {"thread_id": thread_id}}


async def generate_plan(c: Container, principal: Principal, scan_id: uuid.UUID) -> CarePlan:
    scan = await get_scan(c, principal, scan_id)
    if scan.plan is not None:
        return scan.plan

    thread_id = f"care-plan:{scan.id}"
    state = await c.care_plan_graph.ainvoke(
        {"scan_id": str(scan.id), "clinic": scan.clinic_slug, "findings": scan.findings, "triage": scan.triage},
        _config(thread_id),
    )
    plan = CarePlan(
        scan_id=scan.id,
        thread_id=thread_id,
        status=state.get("status", "pending_review"),
        draft=state.get("draft"),
        estimate=state.get("estimate"),
        evidence=state.get("evidence", []),
        path=state.get("path", []),
    )
    async with c.sessionmaker.begin() as session:
        session.add(plan)
    return plan


async def pending_reviews(c: Container, principal: Principal) -> list[CarePlan]:
    clinic = require_dentist(principal)
    stmt = (
        select(CarePlan)
        .join(Scan)
        .options(selectinload(CarePlan.scan))
        .where(Scan.clinic_slug == clinic, CarePlan.status.in_(["pending_review", "escalated"]))
        .order_by(CarePlan.created_at)
    )
    async with c.sessionmaker() as session:
        return list((await session.execute(stmt)).scalars())


async def review_plan(
    c: Container,
    principal: Principal,
    plan_id: uuid.UUID,
    action: Literal["approve", "reject"],
    notes: str | None,
    edited_draft: dict[str, Any] | None,
) -> CarePlan:
    clinic = require_dentist(principal)
    async with c.sessionmaker() as session:
        plan = await session.get(CarePlan, plan_id, options=[selectinload(CarePlan.scan)])
    if plan is None or plan.scan.clinic_slug != clinic:
        raise NotFound()
    if plan.status not in ("pending_review", "escalated"):
        raise Conflict("This plan has already been reviewed.")
    if edited_draft is not None:
        draft = PlanDraft.model_validate(edited_draft)
        unknown = {s.code for s in [*draft.steps, *draft.alternatives]} - c.catalog.treatments.keys()
        if unknown:
            raise BadRequest(f"Unknown treatment codes: {', '.join(sorted(unknown))}")

    state = await c.care_plan_graph.ainvoke(
        Command(resume={"action": action, "notes": notes, "draft": edited_draft}), _config(plan.thread_id)
    )
    async with c.sessionmaker.begin() as session:
        plan = await session.get(CarePlan, plan_id)
        assert plan is not None
        plan.status = state["status"]
        plan.draft = state.get("draft")
        plan.estimate = state.get("estimate")
        plan.path = state.get("path", plan.path)
        plan.reviewer_id = principal.sub
        plan.review_notes = notes
    return plan
