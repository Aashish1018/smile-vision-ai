"""Deterministic OpenAI-compatible LLM server for end-to-end tests and CI.

Point the API at it with
    LLM_PROVIDERS='[{"name":"stub","base_url":"http://localhost:9100/v1","chat_model":"stub","vision_model":"stub"}]'
and run `uv run python -m tests.stub_llm`. Responses are chosen by the requested JSON schema name,
so the real client, parsing and validation code paths are all exercised.
"""

from __future__ import annotations

import json
import sys
import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

CANNED: dict[str, dict] = {
    "Findings": {
        "image_quality": "good",
        "quality_issues": [],
        "teeth_visible": True,
        "observations": [
            {
                "category": "discoloration",
                "location": "upper front teeth",
                "severity": "moderate",
                "confidence": 0.82,
                "evidence": "Even yellow tint across the visible enamel.",
            },
            {
                "category": "chipped_or_worn",
                "location": "upper left central incisor",
                "severity": "mild",
                "confidence": 0.61,
                "evidence": "Slightly uneven biting edge.",
            },
        ],
        "summary": "The teeth show a moderate yellow tint and a slightly uneven edge on one front tooth.",
    },
    "PlanDraft": {
        "steps": [
            {
                "code": "CLEAN",
                "quantity": 1,
                "rationale": "Remove surface stain to set a true baseline shade.",
                "citations": [1],
            },
            {
                "code": "WHITEN_OFFICE",
                "quantity": 1,
                "rationale": "Addresses the moderate yellow tint.",
                "citations": [1],
            },
            {
                "code": "BONDING",
                "quantity": 1,
                "rationale": "Smooths the uneven incisor edge after whitening.",
                "citations": [2],
            },
        ],
        "alternatives": [
            {"code": "VENEER", "quantity": 2, "rationale": "Longer-lasting but irreversible option.", "citations": [2]}
        ],
        "patient_summary": "This is a draft pending your dentist's review: a cleaning, whitening, then bonding one tooth.",
    },
    "Judgement": {"faithful": True, "unsupported_claims": [], "refused": False},
}
ANSWER = "Professional whitening results usually last from six months to three years [1]. Avoid strongly coloured food and drink for 48 hours afterwards [1]."

app = FastAPI()


@app.post("/v1/chat/completions")
async def completions(request: Request):
    body = await request.json()
    if body.get("stream"):

        def chunks():
            for word in ANSWER.split(" "):
                delta = {"choices": [{"index": 0, "delta": {"content": word + " "}}]}
                yield f"data: {json.dumps({'id': 's', 'object': 'chat.completion.chunk', 'created': 0, 'model': 'stub', **delta})}\n\n"
            usage = {"prompt_tokens": 400, "completion_tokens": 30, "total_tokens": 430}
            yield f"data: {json.dumps({'id': 's', 'object': 'chat.completion.chunk', 'created': 0, 'model': 'stub', 'choices': [], 'usage': usage})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(chunks(), media_type="text/event-stream")

    name = (body.get("response_format") or {}).get("json_schema", {}).get("name", "")
    content = json.dumps(CANNED.get(name, {}))
    return JSONResponse(
        {
            "id": "stub",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "stub",
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": content}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        }
    )


if __name__ == "__main__":
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 9100
    uvicorn.run(app, host="0.0.0.0", port=port)
