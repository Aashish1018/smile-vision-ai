"""Embedding and reranking models behind small protocols.

Production uses fastembed (ONNX Runtime, CPU): a bi-encoder for recall and a cross-encoder for
precision. Tests use `HashingEmbedder`, which is deterministic and needs no model download.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Sequence
from functools import cached_property
from typing import Protocol

import numpy as np

_TOKEN = re.compile(r"[a-z0-9]+")


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray: ...
    def embed_query(self, text: str) -> np.ndarray: ...


class Reranker(Protocol):
    def score(self, query: str, texts: Sequence[str]) -> list[float]: ...


def _normalize(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=-1, keepdims=True)
    return m / np.where(norms == 0, 1, norms)


class FastEmbedEmbedder:
    def __init__(self, model_name: str, dim: int) -> None:
        self.model_name = model_name
        self.dim = dim

    @cached_property
    def _model(self):  # loaded lazily: the first call downloads ~70 MB of ONNX weights
        from fastembed import TextEmbedding

        return TextEmbedding(self.model_name)

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray:
        return _normalize(np.array(list(self._model.passage_embed(list(texts))), dtype=np.float32))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalize(np.array(next(iter(self._model.query_embed(text))), dtype=np.float32))


class FastEmbedReranker:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @cached_property
    def _model(self):
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        return TextCrossEncoder(self.model_name)

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        return [float(s) for s in self._model.rerank(query, list(texts))]


class HashingEmbedder:
    """Feature-hashed bag of words. Lexical only, but deterministic and dependency-free."""

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dim, dtype=np.float32)
        for tok in _TOKEN.findall(text.lower()):
            h = int.from_bytes(hashlib.blake2b(tok.encode(), digest_size=8).digest(), "little")
            v[h % self.dim] += 1.0 if (h >> 63) == 0 else -1.0
        return v

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray:
        return _normalize(np.stack([self._vec(t) for t in texts]))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalize(self._vec(text))
