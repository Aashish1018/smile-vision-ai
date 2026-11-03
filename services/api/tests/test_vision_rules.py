"""Deterministic layers on top of the vision model: scoring and triage."""

from smileos.vision.scoring import WEIGHTS, score_findings
from smileos.vision.triage import TriageLevel, triage


def test_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_clean_smile_scores_100(findings_factory):
    scores = score_findings(findings_factory())
    assert scores is not None
    assert scores.overall == 100


def test_penalty_scales_with_severity_and_confidence(findings_factory):
    mild = score_findings(findings_factory(("discoloration", "mild", 0.5)))
    marked = score_findings(findings_factory(("discoloration", "marked", 0.9)))
    assert mild and marked
    assert mild.color == 95  # 100 - 10 * 0.5
    assert marked.color == 66  # 100 - 38 * 0.9
    assert marked.alignment == 100  # unrelated dimension untouched


def test_scores_are_deterministic(findings_factory):
    f = findings_factory(("crowding", "moderate", 0.7), ("gum_inflammation", "mild", 0.6))
    assert score_findings(f) == score_findings(f)


def test_poor_photo_is_not_scored(findings_factory):
    assert score_findings(findings_factory(quality="poor")) is None
    assert triage(findings_factory(quality="poor")).level == TriageLevel.RETAKE


def test_soft_tissue_lesion_escalates_even_at_low_confidence(findings_factory):
    result = triage(findings_factory(("soft_tissue_lesion", "mild", 0.35)))
    assert result.level == TriageLevel.SEE_DENTIST
    assert "examined in person" in result.reasons[0]


def test_low_confidence_mild_decay_stays_routine(findings_factory):
    assert triage(findings_factory(("visible_decay", "mild", 0.9))).level == TriageLevel.ROUTINE
    assert triage(findings_factory(("visible_decay", "moderate", 0.3))).level == TriageLevel.ROUTINE
    assert triage(findings_factory(("visible_decay", "moderate", 0.6))).level == TriageLevel.SEE_DENTIST


def test_cosmetic_findings_are_routine(findings_factory):
    f = findings_factory(("discoloration", "marked", 0.9), ("spacing", "moderate", 0.8))
    assert triage(f).level == TriageLevel.ROUTINE
