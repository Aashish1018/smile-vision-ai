"""Rule-based triage on top of the model's findings.

Escalation is deliberately not left to the LLM. Thresholds are low for soft-tissue lesions
(a false alarm costs a dental visit; a miss can cost far more) and higher for cosmetic categories.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

from smileos.vision.schemas import Category, Findings, Severity


class TriageLevel(StrEnum):
    RETAKE = "retake"  # photo can't support screening
    ROUTINE = "routine"  # cosmetic / maintenance only
    SEE_DENTIST = "see_dentist"  # book a visit soon; don't show cosmetic-only plans


class Triage(BaseModel):
    level: TriageLevel
    reasons: list[str]


LESION_THRESHOLD = 0.3
DECAY_THRESHOLD = 0.5


def triage(findings: Findings) -> Triage:
    if findings.image_quality == "poor" or not findings.teeth_visible:
        return Triage(level=TriageLevel.RETAKE, reasons=findings.quality_issues or ["Teeth not clearly visible"])

    reasons: list[str] = []
    for o in findings.observations:
        if o.category == Category.SOFT_TISSUE_LESION and o.confidence >= LESION_THRESHOLD:
            reasons.append(f"Possible soft-tissue change ({o.location}) should be examined in person.")
        elif o.category == Category.VISIBLE_DECAY and o.severity != Severity.MILD and o.confidence >= DECAY_THRESHOLD:
            reasons.append(f"Possible decay ({o.location}) should be checked before cosmetic work.")
        elif o.category == Category.GUM_INFLAMMATION and o.severity == Severity.MARKED:
            reasons.append(f"Marked gum inflammation ({o.location}) should be treated first.")

    if reasons:
        return Triage(level=TriageLevel.SEE_DENTIST, reasons=reasons)
    return Triage(level=TriageLevel.ROUTINE, reasons=[])
