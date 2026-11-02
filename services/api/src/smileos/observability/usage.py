"""Per-call LLM usage accounting: latency, tokens, provider, outcome.

Every model call produces an `LLMCall`. It goes to an OpenTelemetry span (exportable to
Langfuse, Jaeger, Honeycomb, etc. through OTLP) and to a `UsageRecorder`, which persists it
for the in-app metrics endpoint.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Protocol


@dataclass(slots=True)
class LLMCall:
    operation: str
    provider: str
    model: str
    latency_ms: int
    ok: bool
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    repairs: int = 0
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def as_dict(self) -> dict:
        return asdict(self)


class UsageRecorder(Protocol):
    async def record(self, call: LLMCall) -> None: ...


class MemoryUsageRecorder:
    """Bounded in-process recorder; used in tests and when no database is configured."""

    def __init__(self, maxlen: int = 2000) -> None:
        self.calls: deque[LLMCall] = deque(maxlen=maxlen)

    async def record(self, call: LLMCall) -> None:
        self.calls.append(call)
