"""PII redaction applied to free text before it reaches a model, a log line, or a trace.

Pattern-based on purpose: deterministic, dependency-free and unit-testable. The `redact`
signature matches what an NER-based engine (e.g. Microsoft Presidio) would expose, so one can be
swapped in without touching callers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    # Before PHONE so long digit runs are classified as cards, not phone numbers.
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("GOV_ID", re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")),  # e.g. Aadhaar
    ("PHONE", re.compile(r"(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?!\w)")),
    ("DATE", re.compile(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b")),
]


@dataclass(frozen=True, slots=True)
class RedactionResult:
    text: str
    counts: dict[str, int]

    @property
    def redacted(self) -> bool:
        return bool(self.counts)


def redact(text: str, *, extra_terms: tuple[str, ...] = ()) -> RedactionResult:
    """Replace PII with typed placeholders like `[EMAIL]`. `extra_terms` covers known names, etc."""
    counts: dict[str, int] = {}
    for term in extra_terms:
        if len(term) >= 2:
            text, n = re.subn(rf"\b{re.escape(term)}\b", "[NAME]", text, flags=re.IGNORECASE)
            if n:
                counts["NAME"] = counts.get("NAME", 0) + n
    for label, pattern in _PATTERNS:
        text, n = pattern.subn(f"[{label}]", text)
        if n:
            counts[label] = counts.get(label, 0) + n
    return RedactionResult(text=text, counts=counts)
