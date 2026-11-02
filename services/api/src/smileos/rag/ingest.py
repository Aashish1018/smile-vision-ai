"""Re-index the knowledge base: `uv run smileos-ingest`."""

from __future__ import annotations

import asyncio

from smileos.core.config import get_settings
from smileos.core.logging import configure_logging


async def _run() -> int:
    from smileos.container import Container, ingest_knowledge

    async with Container.open(get_settings()) as container:
        return await ingest_knowledge(container)


def main() -> None:
    configure_logging(json=False)
    n = asyncio.run(_run())
    print(f"Indexed {n} chunks.")
