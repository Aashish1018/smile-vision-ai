# 1. Python for the AI service, TypeScript for the web app

**Status:** accepted

## Context
The prototype was a single Node/Express server whose "AI" was a brightness filter plus one of six canned
reports picked at random. The rebuild needs vision-LLM calls, embeddings, a cross-encoder, an agent framework
and an eval harness.

## Decision
A FastAPI service in Python 3.12 (managed with uv) owns everything model-related. The React app stays in
TypeScript and talks to it over a typed REST/SSE contract: TS types are generated from FastAPI's OpenAPI spec,
and CI fails if they drift.

## Consequences
- Native access to LangGraph, fastembed/ONNX, Pydantic structured outputs and the MCP Python SDK.
- Two toolchains (uv + pnpm). The contract check keeps them honest.
- The same service layer serves REST and MCP, so there's no duplicate business logic.
