"""Provider-agnostic chat model client.

Every provider we target (Ollama locally, Groq / Gemini / OpenRouter hosted) exposes an
OpenAI-compatible `/chat/completions` endpoint, so one client covers all of them. Providers are
tried in order: transport failures, 5xx, rate limits and missing models fall through to the next
one. Structured outputs are requested with a JSON schema, then validated with Pydantic. On a
validation error the model gets one repair turn that includes the error message.
"""

from __future__ import annotations

import base64
import re
import time
from collections.abc import AsyncIterator, Sequence
from typing import Any, Protocol, TypeVar

import openai
from pydantic import BaseModel, ValidationError

from smileos.core.config import LLMProvider, Settings
from smileos.core.errors import ModelUnavailable
from smileos.core.logging import log
from smileos.observability.tracing import tracer
from smileos.observability.usage import LLMCall, UsageRecorder

T = TypeVar("T", bound=BaseModel)

_RETRYABLE = (
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.InternalServerError,
    openai.RateLimitError,
    openai.NotFoundError,
)
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)
_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


class ChatModel(Protocol):
    async def structured(
        self,
        *,
        operation: str,
        system: str,
        user: str,
        schema: type[T],
        images: Sequence[bytes] = (),
        max_repairs: int = 1,
    ) -> T: ...

    def stream(self, *, operation: str, system: str, messages: list[dict]) -> AsyncIterator[str]: ...


def _user_content(text: str, images: Sequence[bytes]) -> str | list[dict]:
    if not images:
        return text
    parts: list[dict] = [{"type": "text", "text": text}]
    for img in images:
        b64 = base64.b64encode(img).decode()
        parts.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    return parts


def _clean_json(raw: str) -> str:
    return _JSON_FENCE.sub("", _THINK_BLOCK.sub("", raw).strip())


class OpenAICompatChatModel:
    def __init__(self, settings: Settings, recorder: UsageRecorder, *, http_client: Any = None) -> None:
        self._providers = settings.llm_providers
        self._seed = settings.llm_seed
        self._recorder = recorder
        self._clients = {
            p.name: openai.AsyncOpenAI(
                base_url=p.base_url,
                api_key=p.api_key.get_secret_value(),
                timeout=settings.llm_timeout_s,
                max_retries=0 if http_client else 1,
                http_client=http_client,
            )
            for p in self._providers
        }

    async def structured(
        self,
        *,
        operation: str,
        system: str,
        user: str,
        schema: type[T],
        images: Sequence[bytes] = (),
        max_repairs: int = 1,
    ) -> T:
        messages: list[Any] = [
            {"role": "system", "content": system},
            {"role": "user", "content": _user_content(user, images)},
        ]
        response_format: Any = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
        }
        last_error: Exception | None = None
        for provider in self._providers:
            model = provider.vision_model if images else provider.chat_model
            convo = list(messages)
            for attempt in range(max_repairs + 1):
                started = time.perf_counter()
                with tracer.start_as_current_span(f"llm.{operation}") as span:
                    span.set_attributes(
                        {"gen_ai.system": provider.name, "gen_ai.request.model": model, "smileos.repair": attempt}
                    )
                    try:
                        resp = await self._clients[provider.name].chat.completions.create(
                            model=model,
                            messages=convo,
                            temperature=0,
                            seed=self._seed,
                            response_format=response_format,
                        )
                    except _RETRYABLE as exc:
                        last_error = exc
                        await self._record(operation, provider, model, started, ok=False, error=repr(exc))
                        log.warning("llm_provider_failed", provider=provider.name, model=model, error=str(exc))
                        break  # next provider
                    usage = resp.usage
                    if usage:
                        span.set_attributes(
                            {
                                "gen_ai.usage.input_tokens": usage.prompt_tokens,
                                "gen_ai.usage.output_tokens": usage.completion_tokens,
                            }
                        )
                    raw = resp.choices[0].message.content or ""
                    try:
                        parsed = schema.model_validate_json(_clean_json(raw))
                    except ValidationError as exc:
                        last_error = exc
                        await self._record(
                            operation,
                            provider,
                            model,
                            started,
                            ok=False,
                            error="validation",
                            usage=usage,
                            repairs=attempt,
                        )
                        convo += [
                            {"role": "assistant", "content": raw},
                            {
                                "role": "user",
                                "content": "Your reply did not match the required JSON schema. "
                                f"Errors:\n{exc}\nReturn only corrected JSON.",
                            },
                        ]
                        continue
                    await self._record(operation, provider, model, started, ok=True, usage=usage, repairs=attempt)
                    return parsed
        raise ModelUnavailable(detail=f"{operation}: all providers failed ({last_error!r})")

    async def stream(self, *, operation: str, system: str, messages: list[dict]) -> AsyncIterator[str]:
        convo: list[Any] = [{"role": "system", "content": system}, *messages]
        last_error: Exception | None = None
        for provider in self._providers:
            started = time.perf_counter()
            emitted = False
            usage = None
            try:
                stream = await self._clients[provider.name].chat.completions.create(
                    model=provider.chat_model,
                    messages=convo,
                    temperature=0.2,
                    seed=self._seed,
                    stream=True,
                    stream_options={"include_usage": True},
                )
                async for chunk in stream:
                    if chunk.usage:
                        usage = chunk.usage
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        emitted = True
                        yield delta
            except _RETRYABLE as exc:
                last_error = exc
                await self._record(operation, provider, provider.chat_model, started, ok=False, error=repr(exc))
                if emitted:  # can't transparently switch providers mid-answer
                    raise ModelUnavailable(detail=f"{operation}: stream interrupted") from exc
                continue
            await self._record(operation, provider, provider.chat_model, started, ok=True, usage=usage)
            return
        raise ModelUnavailable(detail=f"{operation}: all providers failed ({last_error!r})")

    async def _record(
        self,
        operation: str,
        provider: LLMProvider,
        model: str,
        started: float,
        *,
        ok: bool,
        error: str | None = None,
        usage: object | None = None,
        repairs: int = 0,
    ) -> None:
        await self._recorder.record(
            LLMCall(
                operation=operation,
                provider=provider.name,
                model=model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                ok=ok,
                error=error,
                repairs=repairs,
                prompt_tokens=getattr(usage, "prompt_tokens", None),
                completion_tokens=getattr(usage, "completion_tokens", None),
            )
        )
