"""OpenTelemetry setup. Spans follow the GenAI semantic conventions (`gen_ai.*` attributes)."""

from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from smileos.core.config import Settings

tracer = trace.get_tracer("smileos")


def configure_tracing(settings: Settings) -> None:
    """Export spans over OTLP/HTTP when an endpoint is configured; otherwise spans are no-ops."""
    if not settings.otel_exporter_otlp_endpoint:
        return
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    headers = None
    if settings.otel_exporter_otlp_headers:
        headers = dict(pair.split("=", 1) for pair in settings.otel_exporter_otlp_headers.split(",") if "=" in pair)
    provider = TracerProvider(resource=Resource.create({"service.name": "smileos-api"}))
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=f"{settings.otel_exporter_otlp_endpoint.rstrip('/')}/v1/traces",
                headers=headers,
            )
        )
    )
    trace.set_tracer_provider(provider)
