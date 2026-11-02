"""Private object storage for patient photos.

Objects are never publicly addressable. They're streamed through authorised API routes. The
local-disk implementation suits a single node and docker volumes. An S3/Supabase Storage
implementation of the same protocol would use short-lived signed URLs instead.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol


class ObjectStore(Protocol):
    async def put(self, key: str, data: bytes) -> None: ...
    async def get(self, key: str) -> bytes: ...
    async def delete_prefix(self, prefix: str) -> None: ...


class LocalObjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not p.is_relative_to(self.root):
            raise ValueError("invalid object key")
        return p

    async def put(self, key: str, data: bytes) -> None:
        p = self._path(key)
        await asyncio.to_thread(lambda: (p.parent.mkdir(parents=True, exist_ok=True), p.write_bytes(data)))

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def delete_prefix(self, prefix: str) -> None:
        import shutil

        p = self._path(prefix)
        await asyncio.to_thread(lambda: shutil.rmtree(p, ignore_errors=True))
