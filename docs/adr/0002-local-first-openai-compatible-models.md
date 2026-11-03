# 2. Local-first models behind one OpenAI-compatible client

**Status:** accepted

## Context
The demo should cost nothing to run and work offline, but production may want a hosted model. The original plan
considered LiteLLM as a router.

## Decision
Ollama, Groq, Gemini and OpenRouter all expose OpenAI-compatible `/chat/completions`, so one small client
(`llm/client.py`) uses the official `openai` SDK and tries an ordered list of providers. Transport errors, 5xx,
429 and missing models fall through to the next provider. Structured outputs use `response_format: json_schema`
and are validated with Pydantic, with one repair turn on failure. Calls run at temperature 0 with a fixed seed.

LiteLLM was not adopted: one SDK covers every target, and fewer transitive dependencies mean less
supply-chain exposure.

## Consequences
- Swapping models is configuration (`LLM_PROVIDERS`), not code.
- No provider-specific features (e.g. prompt caching) unless added deliberately.
- Every call is recorded (latency, tokens, repairs) for the metrics page and exported as OpenTelemetry spans.
