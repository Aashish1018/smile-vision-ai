"""SmileOS as an MCP server, so any MCP client (Claude Desktop, IDE agents, internal tools) can
use the clinic copilot.

Tools reuse the same services as the REST API. The server acts for one configured dentist
(`SMILEOS_MCP_CLINIC`), so it only sees that clinic's data.

    uv run smileos-mcp                 # stdio (Claude Desktop, MCP Inspector)
    uv run smileos-mcp --http          # streamable HTTP on :8765
"""

from __future__ import annotations

import os
import sys
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, cast

from mcp.server.mcpserver import Context, MCPServer

from smileos.api.schemas import PlanOut, ScanOut
from smileos.container import Container
from smileos.core.config import get_settings
from smileos.core.security import Principal
from smileos.services import plans


@asynccontextmanager
async def lifespan(_: MCPServer) -> AsyncIterator[Container]:
    async with Container.open(get_settings()) as container:
        yield container


mcp = MCPServer(
    name="smileos",
    instructions=(
        "Dental clinic copilot. Search the patient-education knowledge base, look up treatment costs, "
        "and review AI-drafted care plans. Findings are AI screening output, never diagnoses."
    ),
    lifespan=lifespan,
)


def _container(ctx: Context) -> Container:
    return cast(Container, ctx.request_context.lifespan_context)


def _dentist() -> Principal:
    clinic = os.environ.get("SMILEOS_MCP_CLINIC", "smile-studio-pune")
    return Principal(sub=f"mcp:{clinic}", role="dentist", clinic=clinic)


@mcp.tool()
async def search_knowledge(ctx: Context, query: str, k: int = 5) -> list[dict[str, Any]]:
    """Hybrid search (vector + keyword, reranked) over the dental knowledge base. Returns cited passages."""
    hits = await _container(ctx).retriever.retrieve(query, k=min(k, 10))
    return [
        {"chunk_id": h.chunk.id, "title": h.chunk.doc_title, "section": h.chunk.heading, "text": h.chunk.text}
        for h in hits
    ]


@mcp.tool()
async def list_treatments(ctx: Context) -> list[dict[str, Any]]:
    """The treatment catalog: codes, what each addresses, typical duration."""
    return [t.model_dump(mode="json") for t in _container(ctx).catalog.treatments.values()]


@mcp.tool()
async def estimate_cost(ctx: Context, items: list[dict[str, Any]]) -> dict[str, Any]:
    """Estimate cost at this clinic. `items` is a list of {"code": str, "quantity": int}."""
    c = _container(ctx)
    return c.catalog.estimate(
        _dentist().clinic or "", [(i["code"], int(i.get("quantity", 1))) for i in items]
    ).model_dump()


@mcp.tool()
async def pending_reviews(ctx: Context) -> list[dict[str, Any]]:
    """Care plans waiting for the dentist's approval, with the screening findings that led to them."""
    out = []
    for p in await plans.pending_reviews(_container(ctx), _dentist()):
        scan = p.scan
        scan.plan = p
        out.append(ScanOut.of(scan).model_dump(mode="json"))
    return out


@mcp.tool()
async def review_care_plan(ctx: Context, plan_id: str, approve: bool, notes: str = "") -> dict[str, Any]:
    """Approve or reject a drafted care plan. This resumes the paused agent workflow."""
    plan = await plans.review_plan(
        _container(ctx), _dentist(), uuid.UUID(plan_id), "approve" if approve else "reject", notes or None, None
    )
    return PlanOut.of(plan).model_dump(mode="json")


def main() -> None:
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http", port=8765)
    else:
        mcp.run()
