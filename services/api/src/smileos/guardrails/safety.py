"""Clinical-safety guardrails.

SmileOS screens and educates; it does not diagnose. These checks run on model output
deterministically, so a prompt regression can't quietly turn the product into a diagnostic device:

* `find_diagnostic_claims` flags definitive disease statements ("you have oral cancer").
* `enforce_screening_language` rewrites them and appends the escalation notice.
"""

from __future__ import annotations

import re

DISCLAIMER = (
    "This is an AI screening aid, not a diagnosis. Only a licensed dentist can diagnose "
    "conditions after an in-person examination."
)
ESCALATION_NOTICE = (
    "Something in this photo should be looked at by a dentist soon. Please book an in-person "
    "examination; if a sore, patch or lump has lasted more than two weeks, mention that when booking."
)

_CONDITIONS = (
    r"(?:oral\s+)?cancer|carcinoma|malignan\w*|tumou?r|leukoplakia|erythroplakia|lichen\s+planus"
    r"|periodontitis|gingivitis|abscess|caries|cavit(?:y|ies)|infection"
)
# Hedged phrasings ("whether this is an infection", "if it's an abscess") are not claims.
_DEFINITIVE = re.compile(
    rf"\b(?<!whether\s)(?<!if\s)(?:you\s+(?:have|definitely\s+have|are\s+suffering\s+from)|this\s+is|diagnosed\s+with|"
    rf"confirms?|it'?s)\s+(?:clearly\s+)?(?:an?\s+)?(?P<cond>{_CONDITIONS})\b",
    re.IGNORECASE,
)


def find_diagnostic_claims(text: str) -> list[str]:
    return [m.group(0) for m in _DEFINITIVE.finditer(text)]


def enforce_screening_language(text: str) -> tuple[str, bool]:
    """Soften definitive claims into screening language. Returns (text, was_modified)."""
    modified = False

    def _soften(m: re.Match[str]) -> str:
        nonlocal modified
        modified = True
        return f"there may be signs worth checking for {m.group('cond')}"

    out = _DEFINITIVE.sub(_soften, text)
    if modified and ESCALATION_NOTICE not in out:
        out = f"{out.rstrip()}\n\n{ESCALATION_NOTICE}"
    return out, modified
