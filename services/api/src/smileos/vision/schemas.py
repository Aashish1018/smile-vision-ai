"""Structured screening findings returned by the vision model.

The schema is the contract with the model: closed vocabularies, a confidence on every
observation, and a mandatory image-quality assessment so poor photos produce "retake"
instead of invented findings.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Category(StrEnum):
    DISCOLORATION = "discoloration"
    MISALIGNMENT = "misalignment"
    CROWDING = "crowding"
    SPACING = "spacing"
    CHIPPED_OR_WORN = "chipped_or_worn"
    MISSING_TOOTH = "missing_tooth"
    GUM_INFLAMMATION = "gum_inflammation"
    GUM_RECESSION = "gum_recession"
    PLAQUE_OR_CALCULUS = "plaque_or_calculus"
    VISIBLE_DECAY = "visible_decay"
    SOFT_TISSUE_LESION = "soft_tissue_lesion"


class Severity(StrEnum):
    MILD = "mild"
    MODERATE = "moderate"
    MARKED = "marked"


class ImageQuality(StrEnum):
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    POOR = "poor"


class Observation(BaseModel):
    category: Category
    location: str = Field(description="Where in the mouth, e.g. 'upper front teeth', 'lower left gum line'.")
    severity: Severity
    confidence: float = Field(ge=0, le=1, description="How sure you are this is visible in the photo.")
    evidence: str = Field(max_length=240, description="What in the image supports this, in plain words.")


class Findings(BaseModel):
    image_quality: ImageQuality
    quality_issues: list[str] = Field(default_factory=list, description="e.g. 'blurry', 'teeth not visible'.")
    teeth_visible: bool
    observations: list[Observation] = Field(default_factory=list, max_length=12)
    summary: str = Field(max_length=600, description="Two or three neutral, plain-language sentences.")

    def describe(self, min_confidence: float = 0.0) -> str:
        """One line per observation, for prompts. Never includes the patient's identity."""
        lines = [
            f"- {o.category.value} ({o.severity.value}, confidence {o.confidence:.2f}) at {o.location}: {o.evidence}"
            for o in self.observations
            if o.confidence >= min_confidence
        ]
        return "\n".join(lines) or "- No notable observations."
