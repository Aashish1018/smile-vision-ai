"""End-to-end HTTP tests against a real Postgres (pgvector) with a scripted LLM.

Run with TEST_DATABASE_URL set, e.g.
    TEST_DATABASE_URL=postgresql+asyncpg://smileos:smileos@localhost:5432/smileos_test uv run pytest -m db
"""

from __future__ import annotations

import asyncio
import io
import json
import os

import httpx
import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from smileos.agents.care_plan import PlanDraft
from smileos.container import Container
from smileos.core.config import SERVICE_ROOT, Settings, get_settings
from smileos.main import create_app
from smileos.rag.models import HashingEmbedder
from tests.conftest import FakeChatModel, make_findings
from tests.test_imaging import synthetic_smile

DB_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = [pytest.mark.db, pytest.mark.skipif(not DB_URL, reason="TEST_DATABASE_URL not set")]


def _jpeg() -> bytes:
    buf = io.BytesIO()
    synthetic_smile().save(buf, format="JPEG")
    return buf.getvalue()


def _sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.replace("\r\n", "\n").split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line and not line.startswith(":"))
        if "event" in fields:
            events.append((fields["event"], json.loads(fields.get("data") or "null")))
    return events


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    settings = Settings(
        env="test",
        database_url=DB_URL,
        allow_dev_login=True,
        data_dir=tmp_path_factory.mktemp("var"),
    )
    engine = create_async_engine(DB_URL)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()
    os.environ["DATABASE_URL"] = DB_URL  # alembic/env.py reads settings
    get_settings.cache_clear()
    await asyncio.to_thread(command.upgrade, Config(str(SERVICE_ROOT / "alembic.ini")), "head")

    llm = FakeChatModel(
        responses={
            "Findings": make_findings(("discoloration", "moderate", 0.8), ("chipped_or_worn", "mild", 0.6)),
            "PlanDraft": PlanDraft.model_validate(
                {
                    "steps": [{"code": "WHITEN_OFFICE", "quantity": 1, "rationale": "Yellowing.", "citations": [1]}],
                    "patient_summary": "Draft pending your dentist's review.",
                }
            ),
        }
    )
    app = create_app(
        settings, container_factory=lambda: Container.open(settings, llm=llm, embedder=HashingEmbedder(), reranker=None)
    )
    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app), httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _login(client, email, role="patient", clinic=None) -> dict:
    r = await client.post("/api/auth/dev-login", json={"email": email, "role": role, "clinic": clinic})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def test_full_patient_and_dentist_journey(client):
    patient = await _login(client, "pat@example.com")
    other = await _login(client, "other@example.com")
    dentist = await _login(client, "doc@example.com", "dentist", "brightside-dental-austin")

    # Upload streams stages, then the scan.
    r = await client.post(
        "/api/scans",
        headers=patient,
        data={"clinic": "brightside-dental-austin"},
        files={"image": ("smile.jpg", _jpeg(), "image/jpeg")},
    )
    events = _sse(r.text)
    stages = [d["stage"] for e, d in events if e == "stage"]
    assert stages == ["normalizing", "screening", "scoring", "preview", "saving"]
    scan = next(d for e, d in events if e == "scan")
    assert scan["triage"]["level"] == "routine"
    assert scan["scores"]["color"] < 100
    assert scan["preview_available"] is True
    sid = scan["id"]

    # Access control: owner and the clinic's dentist can read; another patient can't.
    assert (await client.get(f"/api/scans/{sid}", headers=patient)).status_code == 200
    assert (await client.get(f"/api/scans/{sid}", headers=other)).status_code == 404
    assert (await client.get(f"/api/scans/{sid}/image/preview", headers=dentist)).headers[
        "content-type"
    ] == "image/jpeg"
    assert (await client.get(f"/api/scans/{sid}/image/original", headers=other)).status_code == 404

    # Agent drafts a plan that pauses for review.
    plan = (await client.post(f"/api/scans/{sid}/plan", headers=patient)).json()
    assert plan["status"] == "pending_review"
    assert [s["code"] for s in plan["draft"]["steps"]] == ["EXAM", "WHITEN_OFFICE"]
    assert plan["estimate"]["currency"] == "USD"
    assert plan["evidence"]

    # Patients can't review; the dentist sees it in the queue and approves.
    assert (await client.get("/api/clinic/reviews", headers=patient)).status_code == 403
    queue = (await client.get("/api/clinic/reviews", headers=dentist)).json()
    assert [q["id"] for q in queue] == [sid]
    r = await client.post(
        f"/api/clinic/plans/{plan['id']}/review", headers=dentist, json={"action": "approve", "notes": "Looks right."}
    )
    assert r.json()["status"] == "approved"
    r = await client.post(f"/api/clinic/plans/{plan['id']}/review", headers=dentist, json={"action": "reject"})
    assert r.status_code == 409
    assert (await client.get("/api/clinic/reviews", headers=dentist)).json() == []

    # Sharing needs explicit consent and exposes only images + scores.
    assert (
        await client.put(f"/api/scans/{sid}/share", headers=patient, json={"enabled": True, "consent": False})
    ).status_code == 400
    token = (
        await client.put(f"/api/scans/{sid}/share", headers=patient, json={"enabled": True, "consent": True})
    ).json()["share_token"]
    public = await client.get(f"/api/public/share/{token}")
    assert public.status_code == 200 and set(public.json()) == {"clinic_name", "created_at", "scores"}
    assert (await client.get(f"/api/public/share/{token}/image/preview")).status_code == 200
    await client.put(f"/api/scans/{sid}/share", headers=patient, json={"enabled": False, "consent": False})
    assert (await client.get(f"/api/public/share/{token}")).status_code == 404

    # Grounded chat about the scan.
    r = await client.post(
        "/api/chat", headers=patient, json={"question": "How long does whitening last?", "scan_id": sid}
    )
    kinds = [e for e, _ in _sse(r.text)]
    assert kinds[0] == "citations" and kinds[-1] == "done" and "token" in kinds

    # Metrics are dentist-only.
    assert (await client.get("/api/clinic/metrics", headers=patient)).status_code == 403
    m = (await client.get("/api/clinic/metrics", headers=dentist)).json()
    assert m["plans"] == {"approved": 1} and m["triage"] == {"routine": 1}

    # Deleting removes the scan for everyone.
    assert (await client.delete(f"/api/scans/{sid}", headers=other)).status_code == 404
    assert (await client.delete(f"/api/scans/{sid}", headers=patient)).status_code == 204
    assert (await client.get(f"/api/scans/{sid}", headers=patient)).status_code == 404


async def test_auth_is_required(client):
    assert (await client.get("/api/scans")).status_code == 401
    assert (await client.get("/api/scans", headers={"Authorization": "Bearer nope"})).status_code == 401
    body = (await client.get("/api/scans")).json()
    assert body == {"error": {"code": "unauthorized", "message": "Authentication required."}}


async def test_rejects_non_images_and_unknown_clinics(client):
    patient = await _login(client, "pat2@example.com")
    r = await client.post(
        "/api/scans",
        headers=patient,
        data={"clinic": "brightside-dental-austin"},
        files={"image": ("x.txt", b"hello", "text/plain")},
    )
    assert next(d for e, d in _sse(r.text) if e == "error")["code"] == "bad_request"
    r = await client.post(
        "/api/scans", headers=patient, data={"clinic": "nope"}, files={"image": ("s.jpg", _jpeg(), "image/jpeg")}
    )
    assert next(d for e, d in _sse(r.text) if e == "error")["message"] == "Unknown clinic."


async def test_dentist_login_requires_known_clinic(client):
    r = await client.post("/api/auth/dev-login", json={"email": "d@example.com", "role": "dentist", "clinic": "fake"})
    assert r.status_code == 400


async def test_health_endpoints(client):
    assert (await client.get("/healthz")).json() == {"status": "ok"}
    ready = (await client.get("/readyz")).json()
    assert ready["status"] == "ready" and ready["knowledge_chunks"] > 60
