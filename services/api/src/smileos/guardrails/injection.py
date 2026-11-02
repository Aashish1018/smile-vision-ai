"""Prompt-injection screening for untrusted text: retrieved chunks and user questions.

Retrieved documents are data, not instructions. Chunks that look like they're trying to steer
the model are dropped before they reach the prompt, and user questions that try it are flagged
so the answer prompt can ignore the attempt. Heuristic and conservative: it catches common
patterns and doesn't claim to be complete.
"""

from __future__ import annotations

import re

_SIGNALS = re.compile(
    r"ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?)"
    r"|disregard\s+(?:the\s+)?(?:system|previous)\s+(?:prompt|instructions)"
    r"|you\s+are\s+now\s+(?:a|an|in)\b"
    r"|reveal\s+(?:your|the)\s+(?:system\s+)?prompt"
    r"|<\s*/?\s*(?:system|assistant)\s*>"
    r"|\bBEGIN\s+(?:SYSTEM|ADMIN)\b",
    re.IGNORECASE,
)


def looks_like_injection(text: str) -> bool:
    return bool(_SIGNALS.search(text))
