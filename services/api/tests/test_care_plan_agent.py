"""Care-plan graph: routing, deterministic validation, redraft loop, and human-in-the-loop resume."""

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from smileos.agents.care_plan import AgentDeps, PlanDraft, build_care_plan_graph
from smileos.vision.triage import triage
from tests.conftest import FakeChatModel


def _draft(*steps, alternatives=()):
    return PlanDraft.model_validate(
        {
            "steps": [{"code": c, "quantity": q, "rationale": "because", "citations": cites} for c, q, cites in steps],
            "alternatives": [
                {"code": c, "quantity": q, "rationale": "alt", "citations": cites} for c, q, cites in alternatives
            ],
            "patient_summary": "Draft plan pending your dentist's review.",
        }
    )


async def _run(retriever, catalog, findings, llm, thread="t1"):
    graph = build_care_plan_graph(AgentDeps(llm=llm, retriever=retriever, catalog=catalog), InMemorySaver())
    config = {"configurable": {"thread_id": thread}}
    state = await graph.ainvoke(
        {"scan_id": "s", "clinic": "brightside-dental-austin", "findings": findings.model_dump(mode="json"),
         "triage": triage(findings).model_dump(mode="json")},
        config,
    )  # fmt: skip
    return graph, config, state


async def test_routine_path_drafts_sequences_estimates_and_pauses(retriever, catalog, findings_factory):
    findings = findings_factory(("discoloration", "moderate", 0.8), ("chipped_or_worn", "mild", 0.7))
    # Deliberately out of clinical order: bonding before whitening.
    llm = FakeChatModel(responses={"PlanDraft": _draft(("BONDING", 2, [1]), ("WHITEN_OFFICE", 1, [1]))})
    graph, config, state = await _run(retriever, catalog, findings, llm)

    assert state["path"] == ["gate", "retrieve", "draft", "validate", "estimate"]
    codes = [s["code"] for s in state["draft"]["steps"]]
    assert codes == ["EXAM", "WHITEN_OFFICE", "BONDING"]  # exam added, whitening moved before bonding
    est = state["estimate"]
    assert est["currency"] == "USD"
    assert est["total_low"] == 75 + 500 + 2 * 300
    assert state["status"] == "pending_review"
    assert (await graph.aget_state(config)).next == ("review",)  # paused for the dentist

    final = await graph.ainvoke(Command(resume={"action": "approve", "notes": "ok"}), config)
    assert final["status"] == "approved"
    assert final["path"][-1] == "review"


async def test_dentist_edit_recomputes_estimate(retriever, catalog, findings_factory):
    findings = findings_factory(("discoloration", "moderate", 0.8))
    llm = FakeChatModel(responses={"PlanDraft": _draft(("WHITEN_OFFICE", 1, [1]))})
    graph, config, _ = await _run(retriever, catalog, findings, llm)
    edited = _draft(("EXAM", 1, [1]), ("WHITEN_HOME", 1, [1])).model_dump()
    final = await graph.ainvoke(Command(resume={"action": "approve", "draft": edited}), config)
    assert [line["code"] for line in final["estimate"]["lines"]] == ["EXAM", "WHITEN_HOME"]


async def test_invalid_codes_and_missing_citations_trigger_a_redraft(retriever, catalog, findings_factory):
    findings = findings_factory(("misalignment", "moderate", 0.8))
    drafts = iter([
        _draft(("IMPLANT", 1, [1]), ("ALIGNERS", 1, [])),  # wrong code, uncited step
        _draft(("ALIGNERS", 1, [1])),
    ])  # fmt: skip
    llm = FakeChatModel(responses={"PlanDraft": lambda _: next(drafts)})
    _, _, state = await _run(retriever, catalog, findings, llm)

    assert state["path"].count("draft") == 2
    assert "not in the allowed list" in llm.calls[1]["user"]  # errors fed back to the model
    assert [s["code"] for s in state["draft"]["steps"]] == ["EXAM", "ALIGNERS"]


async def test_lesion_escalates_without_calling_the_llm(retriever, catalog, findings_factory):
    findings = findings_factory(("soft_tissue_lesion", "mild", 0.4), ("discoloration", "marked", 0.9))
    llm = FakeChatModel()
    _, _, state = await _run(retriever, catalog, findings, llm)

    assert state["path"] == ["gate", "escalate", "estimate"]
    assert [s["code"] for s in state["draft"]["steps"]] == ["EXAM", "SPECIALIST_REFERRAL"]
    assert not any(s["code"].startswith("WHITEN") for s in state["draft"]["steps"])
    assert state["status"] == "escalated"
    assert llm.calls == []


async def test_poor_photo_asks_for_retake(retriever, catalog, findings_factory):
    _, _, state = await _run(retriever, catalog, findings_factory(quality="poor"), FakeChatModel())
    assert state["path"] == ["gate", "retake"]
    assert state["status"] == "needs_retake"


@pytest.mark.parametrize("code", ["SPECIALIST_REFERRAL", "RCT"])
async def test_model_cannot_add_codes_outside_the_menu(retriever, catalog, findings_factory, code):
    findings = findings_factory(("discoloration", "mild", 0.9))
    llm = FakeChatModel(responses={"PlanDraft": _draft(("WHITEN_HOME", 1, [1]), (code, 1, [1]))})
    _, _, state = await _run(retriever, catalog, findings, llm)
    assert code not in [s["code"] for s in state["draft"]["steps"]]
