from __future__ import annotations

import os
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

import pytest
from pydantic import BaseModel

os.environ.setdefault("ENV", "test")

from smileos.agents.catalog import load_catalog
from smileos.core.config import SERVICE_ROOT
from smileos.rag.documents import chunk_document, load_documents
from smileos.rag.models import HashingEmbedder
from smileos.rag.retriever import HybridRetriever
from smileos.rag.store import MemoryChunkStore
from smileos.vision.schemas import Findings

KNOWLEDGE = SERVICE_ROOT / "knowledge"


@dataclass
class FakeChatModel:
    """Scripted ChatModel. `responses` maps schema name → value (or callable(user_prompt) → value)."""

    responses: dict[str, Any] = field(default_factory=dict)
    stream_text: str = "Whitening uses a peroxide gel to lighten enamel [1]."
    calls: list[dict[str, Any]] = field(default_factory=list)

    async def structured(
        self, *, operation, system, user, schema: type[BaseModel], images: Sequence[bytes] = (), max_repairs=1
    ):
        self.calls.append({"operation": operation, "user": user, "images": len(images)})
        value = self.responses[schema.__name__]
        if callable(value):
            value = value(user)
        return value if isinstance(value, BaseModel) else schema.model_validate(value)

    async def stream(self, *, operation, system, messages) -> AsyncIterator[str]:
        self.calls.append({"operation": operation, "messages": messages})
        for word in self.stream_text.split(" "):
            yield word + " "


def make_findings(*observations: tuple[str, str, float], quality: str = "good", teeth: bool = True) -> Findings:
    return Findings.model_validate(
        {
            "image_quality": quality,
            "teeth_visible": teeth,
            "quality_issues": [] if quality != "poor" else ["blurry"],
            "observations": [
                {
                    "category": c,
                    "severity": s,
                    "confidence": conf,
                    "location": "upper front teeth",
                    "evidence": "visible",
                }
                for c, s, conf in observations
            ],
            "summary": "Screening summary.",
        }
    )


@pytest.fixture(scope="session")
def catalog():
    return load_catalog(KNOWLEDGE / "catalog.yaml")


@pytest.fixture(scope="session")
def chunks():
    return [c for d in load_documents(KNOWLEDGE / "articles") for c in chunk_document(d)]


@pytest.fixture
async def retriever(chunks) -> HybridRetriever:
    embedder = HashingEmbedder()
    store = MemoryChunkStore()
    await store.replace_all(chunks, embedder.embed_documents([c.contextual_text for c in chunks]))
    return HybridRetriever(store, embedder, reranker=None)


@pytest.fixture
def findings_factory() -> Callable[..., Findings]:
    return make_findings
