"""Provider fallback and schema-repair behaviour, against a mocked OpenAI-compatible HTTP API."""

import json

import httpx2
import pytest
from pydantic import BaseModel

from smileos.core.config import LLMProvider, Settings
from smileos.core.errors import ModelUnavailable
from smileos.llm.client import OpenAICompatChatModel
from smileos.observability.usage import MemoryUsageRecorder


class Answer(BaseModel):
    answer: str
    confidence: float


def _settings() -> Settings:
    return Settings(
        llm_providers=[
            LLMProvider(name="local", base_url="http://local.test/v1", chat_model="small", vision_model="small-vl"),
            LLMProvider(name="hosted", base_url="http://hosted.test/v1", chat_model="big", vision_model="big-vl"),
        ],
        llm_timeout_s=5,
    )


class FakeHosts:
    """Routes requests by host to scripted responses and records every request body."""

    def __init__(self, **hosts):
        self.hosts = {h: list(r) if isinstance(r, list) else r for h, r in hosts.items()}
        self.requests: list[tuple[str, dict]] = []

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        host = request.url.host.split(".")[0]
        self.requests.append((host, json.loads(request.content)))
        r = self.hosts[host]
        return r.pop(0) if isinstance(r, list) else r

    def model(self, settings: Settings, recorder: MemoryUsageRecorder) -> OpenAICompatChatModel:
        return OpenAICompatChatModel(
            settings, recorder, http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(self))
        )


def _completion(content: str) -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "x", "object": "chat.completion", "created": 0, "model": "m",
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": content}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        },
    )  # fmt: skip


async def test_falls_back_to_next_provider_on_server_error():
    hosts = FakeHosts(local=httpx2.Response(500), hosted=_completion('{"answer": "ok", "confidence": 0.9}'))
    recorder = MemoryUsageRecorder()
    result = await hosts.model(_settings(), recorder).structured(operation="t", system="s", user="u", schema=Answer)
    assert result.answer == "ok"
    assert [h for h, _ in hosts.requests] == ["local", "hosted"]
    assert [(c.provider, c.ok) for c in recorder.calls] == [("local", False), ("hosted", True)]
    assert recorder.calls[-1].prompt_tokens == 10


async def test_repairs_invalid_json_once():
    hosts = FakeHosts(
        local=[
            _completion('{"answer": "missing confidence"}'),
            _completion('```json\n{"answer": "fixed", "confidence": 1}\n```'),
        ]
    )
    recorder = MemoryUsageRecorder()
    result = await hosts.model(_settings(), recorder).structured(operation="t", system="s", user="u", schema=Answer)
    assert result.answer == "fixed"
    assert "did not match the required JSON schema" in hosts.requests[1][1]["messages"][-1]["content"]
    assert recorder.calls[-1].repairs == 1


async def test_vision_requests_use_vision_model_and_inline_image():
    hosts = FakeHosts(local=_completion('{"answer": "a", "confidence": 0.5}'))
    await hosts.model(_settings(), MemoryUsageRecorder()).structured(
        operation="t", system="s", user="u", schema=Answer, images=[b"\xff\xd8jpeg"]
    )
    body = hosts.requests[0][1]
    assert body["model"] == "small-vl"
    assert body["temperature"] == 0 and body["seed"] == 7
    assert body["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")


async def test_raises_when_all_providers_fail():
    hosts = FakeHosts(local=httpx2.Response(503), hosted=httpx2.Response(503))
    with pytest.raises(ModelUnavailable):
        await hosts.model(_settings(), MemoryUsageRecorder()).structured(
            operation="t", system="s", user="u", schema=Answer
        )


async def test_stream_yields_tokens():
    sse = (
        'data: {"id":"x","object":"chat.completion.chunk","created":0,"model":"m","choices":[{"index":0,"delta":{"content":"Hel"}}]}\n\n'
        'data: {"id":"x","object":"chat.completion.chunk","created":0,"model":"m","choices":[{"index":0,"delta":{"content":"lo"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    hosts = FakeHosts(local=httpx2.Response(200, text=sse, headers={"content-type": "text/event-stream"}))
    tokens = [
        t async for t in hosts.model(_settings(), MemoryUsageRecorder()).stream(operation="t", system="s", messages=[])
    ]
    assert "".join(tokens) == "Hello"
