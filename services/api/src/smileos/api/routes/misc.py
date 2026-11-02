"""Auth, clinics, public share pages and health probes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Response
from sqlalchemy import text

from smileos.api.deps import ContainerDep, PrincipalDep
from smileos.api.schemas import ClinicOut, DevLoginIn, MeOut, SharedScanOut, TokenOut
from smileos.core.errors import BadRequest, Forbidden, NotFound
from smileos.services import scans
from smileos.vision.scoring import Scores

router = APIRouter()


@router.post("/api/auth/dev-login", response_model=TokenOut, tags=["auth"])
async def dev_login(body: DevLoginIn, c: ContainerDep) -> TokenOut:
    """Local/demo only: issues a signed token without an identity provider."""
    if not c.settings.allow_dev_login:
        raise Forbidden()
    if body.role == "dentist" and body.clinic not in c.catalog.clinics:
        raise BadRequest("Dentists must belong to a known clinic.")
    token, _ = c.verifier.issue_dev_token(body.email, body.role, body.clinic if body.role == "dentist" else None)
    return TokenOut(access_token=token)


@router.get("/api/me", response_model=MeOut, tags=["auth"])
async def me(principal: PrincipalDep) -> MeOut:
    return MeOut(sub=principal.sub, role=principal.role, clinic=principal.clinic)


@router.get("/api/clinics", response_model=list[ClinicOut], tags=["clinic"])
async def clinics(c: ContainerDep) -> list[ClinicOut]:
    return [ClinicOut(slug=k.slug, name=k.name, currency=k.currency) for k in c.catalog.clinics.values()]


@router.get("/api/public/share/{token}", response_model=SharedScanOut, tags=["public"])
async def shared(token: str, c: ContainerDep) -> SharedScanOut:
    scan = await scans.get_shared(c, token)
    return SharedScanOut(
        clinic_name=c.catalog.clinics[scan.clinic_slug].name,
        created_at=scan.created_at,
        scores=Scores.model_validate(scan.scores) if scan.scores else None,
    )


@router.get("/api/public/share/{token}/image/{kind}", response_class=Response, tags=["public"])
async def shared_image(token: str, kind: Literal["original", "preview"], c: ContainerDep) -> Response:
    scan = await scans.get_shared(c, token)
    key = scan.original_key if kind == "original" else scan.preview_key
    if key is None:
        raise NotFound()
    return Response(await c.objects.get(key), media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.get("/healthz", tags=["ops"])
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz", tags=["ops"])
async def readyz(c: ContainerDep) -> dict:
    async with c.sessionmaker() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ready", "knowledge_chunks": await c.store.count()}
