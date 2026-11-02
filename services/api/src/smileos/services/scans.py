"""Scan lifecycle and access control.

Access rules: patients see only their own scans. Dentists see scans submitted to their
clinic. Public share links expose only the before/after images and scores, and only after the
owner explicitly opts in.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from smileos.container import Container
from smileos.core.errors import BadRequest, Forbidden, NotFound
from smileos.core.security import Principal
from smileos.db.models import Scan
from smileos.vision.screening import StageCallback, screen_photo


def _can_read(principal: Principal, scan: Scan) -> bool:
    if scan.owner_id == principal.sub:
        return True
    return principal.role == "dentist" and principal.clinic == scan.clinic_slug


async def create_scan(
    c: Container, principal: Principal, clinic_slug: str, raw: bytes, on_stage: StageCallback
) -> Scan:
    if clinic_slug not in c.catalog.clinics:
        raise BadRequest("Unknown clinic.")
    result = await screen_photo(raw, llm=c.llm, max_side=c.settings.max_image_side, on_stage=on_stage)

    await on_stage("saving")
    scan_id = uuid.uuid4()
    original_key = f"scans/{scan_id}/original.jpg"
    await c.objects.put(original_key, result.photo)
    preview_key = None
    if result.preview and result.preview.applied:
        preview_key = f"scans/{scan_id}/preview.jpg"
        await c.objects.put(preview_key, result.preview.image)

    scan = Scan(
        id=scan_id,
        owner_id=principal.sub,
        clinic_slug=clinic_slug,
        original_key=original_key,
        preview_key=preview_key,
        preview_applied=bool(preview_key),
        findings=result.findings.model_dump(mode="json"),
        scores=result.scores.model_dump() if result.scores else None,
        triage=result.triage.model_dump(mode="json"),
        model_meta={
            "prompt_version": result.prompt_version,
            "latency_ms": result.latency_ms,
            "preview_method": result.preview.method if result.preview else None,
            "mask_coverage": result.preview.mask_coverage if result.preview else None,
        },
    )
    async with c.sessionmaker.begin() as session:
        session.add(scan)
    return scan


async def get_scan(c: Container, principal: Principal, scan_id: uuid.UUID) -> Scan:
    async with c.sessionmaker() as session:
        scan = await session.get(Scan, scan_id, options=[selectinload(Scan.plan)])
    if scan is None:
        raise NotFound()
    if not _can_read(principal, scan):
        raise NotFound()  # don't reveal existence
    return scan


async def list_scans(c: Container, principal: Principal) -> list[Scan]:
    stmt = select(Scan).options(selectinload(Scan.plan)).order_by(Scan.created_at.desc()).limit(100)
    if principal.role == "dentist" and principal.clinic:
        stmt = stmt.where(Scan.clinic_slug == principal.clinic)
    else:
        stmt = stmt.where(Scan.owner_id == principal.sub)
    async with c.sessionmaker() as session:
        return list((await session.execute(stmt)).scalars())


async def delete_scan(c: Container, principal: Principal, scan_id: uuid.UUID) -> None:
    async with c.sessionmaker.begin() as session:
        scan = await session.get(Scan, scan_id)
        if scan is None or scan.owner_id != principal.sub:
            raise NotFound()
        await session.delete(scan)
    await c.objects.delete_prefix(f"scans/{scan_id}")


async def set_sharing(c: Container, principal: Principal, scan_id: uuid.UUID, enabled: bool) -> Scan:
    async with c.sessionmaker.begin() as session:
        scan = await session.get(Scan, scan_id)
        if scan is None or scan.owner_id != principal.sub:
            raise NotFound()
        if enabled and not scan.preview_applied:
            raise BadRequest("This scan has no preview to share.")
        scan.share_token = secrets.token_urlsafe(16) if enabled else None
        scan.shared_at = datetime.now(UTC) if enabled else None
    return scan


async def get_shared(c: Container, token: str) -> Scan:
    async with c.sessionmaker() as session:
        scan = (await session.execute(select(Scan).where(Scan.share_token == token))).scalar_one_or_none()
    if scan is None:
        raise NotFound()
    return scan


def require_dentist(principal: Principal) -> str:
    if principal.role != "dentist" or not principal.clinic:
        raise Forbidden()
    return principal.clinic
