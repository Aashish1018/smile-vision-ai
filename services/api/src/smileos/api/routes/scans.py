from __future__ import annotations

import asyncio
import json
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, Response, UploadFile
from sse_starlette import EventSourceResponse

from smileos.api.deps import ContainerDep, PrincipalDep, RateLimiter
from smileos.api.schemas import PlanOut, ScanOut, ShareIn
from smileos.core.errors import AppError, BadRequest, NotFound
from smileos.core.logging import log
from smileos.core.security import Principal
from smileos.services import plans, scans

router = APIRouter(prefix="/api/scans", tags=["scans"])
scan_limit = RateLimiter(limit=20, window_s=3600)


@router.post(
    "",
    summary="Upload a smile photo and stream screening progress",
    description=(
        "Server-sent events: `stage` (normalizing → screening → scoring → preview → saving), "
        "then `scan` with the result, or `error`."
    ),
)
async def create_scan(
    c: ContainerDep,
    principal: Annotated[Principal, Depends(scan_limit)],
    image: UploadFile,
    clinic: Annotated[str, Form()],
) -> EventSourceResponse:
    raw = await image.read(c.settings.max_upload_bytes + 1)
    if len(raw) > c.settings.max_upload_bytes:
        raise BadRequest(f"Photos must be under {c.settings.max_upload_bytes // (1024 * 1024)} MB.")

    queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()

    async def on_stage(stage: str) -> None:
        await queue.put(("stage", json.dumps({"stage": stage})))

    async def run() -> None:
        try:
            scan = await scans.create_scan(c, principal, clinic, raw, on_stage)
            await queue.put(("scan", ScanOut.of(scan, include_plan=False).model_dump_json()))
        except AppError as exc:
            log.info("scan_failed", code=exc.code, detail=str(exc))
            await queue.put(("error", json.dumps({"code": exc.code, "message": exc.public_message})))
        except Exception:
            log.exception("scan_crashed")
            await queue.put(("error", json.dumps({"code": "internal_error", "message": AppError.public_message})))
        finally:
            await queue.put(("end", ""))

    async def events():
        task = asyncio.create_task(run())
        try:
            while (item := await queue.get())[0] != "end":
                yield {"event": item[0], "data": item[1]}
        finally:
            task.cancel()

    return EventSourceResponse(events(), ping=15)


@router.get("", response_model=list[ScanOut])
async def list_scans(c: ContainerDep, principal: PrincipalDep) -> list[ScanOut]:
    return [ScanOut.of(s) for s in await scans.list_scans(c, principal)]


@router.get("/{scan_id}", response_model=ScanOut)
async def get_scan(scan_id: uuid.UUID, c: ContainerDep, principal: PrincipalDep) -> ScanOut:
    return ScanOut.of(await scans.get_scan(c, principal, scan_id))


@router.get("/{scan_id}/image/{kind}", response_class=Response, responses={200: {"content": {"image/jpeg": {}}}})
async def get_image(
    scan_id: uuid.UUID, kind: Literal["original", "preview"], c: ContainerDep, principal: PrincipalDep
) -> Response:
    scan = await scans.get_scan(c, principal, scan_id)
    key = scan.original_key if kind == "original" else scan.preview_key
    if key is None:
        raise NotFound()
    return Response(
        await c.objects.get(key), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.delete("/{scan_id}", status_code=204)
async def delete_scan(scan_id: uuid.UUID, c: ContainerDep, principal: PrincipalDep) -> Response:
    await scans.delete_scan(c, principal, scan_id)
    return Response(status_code=204)


@router.put("/{scan_id}/share", response_model=ScanOut)
async def share_scan(scan_id: uuid.UUID, body: ShareIn, c: ContainerDep, principal: PrincipalDep) -> ScanOut:
    if body.enabled and not body.consent:
        raise BadRequest("Sharing requires your explicit consent.")
    await scans.set_sharing(c, principal, scan_id, body.enabled)
    return ScanOut.of(await scans.get_scan(c, principal, scan_id))


@router.post("/{scan_id}/plan", response_model=PlanOut, summary="Generate (or fetch) the AI care-plan draft")
async def create_plan(scan_id: uuid.UUID, c: ContainerDep, principal: PrincipalDep) -> PlanOut:
    return PlanOut.of(await plans.generate_plan(c, principal, scan_id))
