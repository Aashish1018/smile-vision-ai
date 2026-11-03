"""Photo screening pipeline: normalize → vision findings → scores → triage → preview."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from smileos.imaging.normalize import normalize_photo
from smileos.imaging.preview import PreviewResult, whiten
from smileos.llm.client import ChatModel
from smileos.vision.prompts import FINDINGS_PROMPT_VERSION, FINDINGS_SYSTEM, FINDINGS_USER
from smileos.vision.schemas import Findings
from smileos.vision.scoring import Scores, score_findings
from smileos.vision.triage import Triage, TriageLevel, triage

StageCallback = Callable[[str], Awaitable[None]]


@dataclass(frozen=True, slots=True)
class ScreeningResult:
    photo: bytes
    findings: Findings
    scores: Scores | None
    triage: Triage
    preview: PreviewResult | None
    latency_ms: int
    prompt_version: str = FINDINGS_PROMPT_VERSION


async def _noop(_: str) -> None:
    return None


async def screen_photo(
    raw: bytes, *, llm: ChatModel, max_side: int, on_stage: StageCallback = _noop
) -> ScreeningResult:
    started = time.perf_counter()
    await on_stage("normalizing")
    photo = await asyncio.to_thread(normalize_photo, raw, max_side=max_side)

    await on_stage("screening")
    findings = await llm.structured(
        operation="vision.findings",
        system=FINDINGS_SYSTEM,
        user=FINDINGS_USER,
        schema=Findings,
        images=[photo],
    )

    await on_stage("scoring")
    scores = score_findings(findings)
    tri = triage(findings)

    preview = None
    if tri.level != TriageLevel.RETAKE:
        await on_stage("preview")
        preview = await asyncio.to_thread(whiten, photo)

    return ScreeningResult(
        photo=photo,
        findings=findings,
        scores=scores,
        triage=tri,
        preview=preview,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
