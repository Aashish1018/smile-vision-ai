"""Deterministic smile-aesthetics index derived from structured findings.

These are not clinical measurements. Each dimension starts at 100 and loses points for every
observation that affects it, weighted by severity and the model's confidence:

    dimension = 100 - sum(SEVERITY_PENALTY[severity] * confidence)   (clamped to 0..100)
    overall   = weighted mean of the dimensions (WEIGHTS)

The same findings always give the same scores, and every point lost traces back to an
observation the UI can show.
"""

from __future__ import annotations

from pydantic import BaseModel

from smileos.vision.schemas import Category, Findings, Severity

SEVERITY_PENALTY: dict[Severity, float] = {
    Severity.MILD: 10.0,
    Severity.MODERATE: 22.0,
    Severity.MARKED: 38.0,
}

DIMENSIONS: dict[str, tuple[Category, ...]] = {
    "color": (Category.DISCOLORATION, Category.PLAQUE_OR_CALCULUS),
    "alignment": (Category.MISALIGNMENT, Category.CROWDING),
    "spacing": (Category.SPACING, Category.MISSING_TOOTH, Category.CROWDING),
    "tooth_integrity": (Category.CHIPPED_OR_WORN, Category.VISIBLE_DECAY, Category.MISSING_TOOTH),
    "gum_health": (Category.GUM_INFLAMMATION, Category.GUM_RECESSION, Category.PLAQUE_OR_CALCULUS),
}

WEIGHTS: dict[str, float] = {
    "color": 0.20,
    "alignment": 0.20,
    "spacing": 0.15,
    "tooth_integrity": 0.20,
    "gum_health": 0.25,
}


class Scores(BaseModel):
    color: int
    alignment: int
    spacing: int
    tooth_integrity: int
    gum_health: int
    overall: int


def score_findings(findings: Findings) -> Scores | None:
    """Return None when the photo can't support scoring (poor quality or no teeth visible)."""
    if findings.image_quality == "poor" or not findings.teeth_visible:
        return None
    dims: dict[str, int] = {}
    for dim, categories in DIMENSIONS.items():
        penalty = sum(
            SEVERITY_PENALTY[o.severity] * o.confidence for o in findings.observations if o.category in categories
        )
        dims[dim] = round(max(0.0, min(100.0, 100.0 - penalty)))
    overall = round(sum(dims[d] * w for d, w in WEIGHTS.items()))
    return Scores(**dims, overall=overall)
