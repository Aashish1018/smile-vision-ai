import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { Plan, Scan } from "@/lib/api";
import { CarePlanCard } from "./CarePlanCard";
import { ChatPanel } from "./ChatPanel";
import { FindingsList, TriageBanner } from "./ScreeningPanels";

function sseResponse(events: [string, unknown][]) {
  const body = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

afterEach(() => vi.restoreAllMocks());

describe("ChatPanel", () => {
  it("streams tokens, shows only cited sources, and applies guardrail replacements", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sseResponse([
        ["citations", [
          { n: 1, title: "Teeth whitening", heading: "Timeline", url: "https://example.org/w" },
          { n: 2, title: "Veneers", heading: "Cost", url: null },
        ]],
        ["token", "You have "],
        ["token", "gingivitis [1]."],
        ["replace", "There may be signs worth checking for gingivitis [1]."],
        ["done", { grounded: true }],
      ]),
    );
    render(<ChatPanel scanId="s1" />);
    await userEvent.type(screen.getByLabelText("Your question"), "what is this?");
    await userEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(screen.getByText(/may be signs worth checking/)).toBeInTheDocument());
    expect(screen.queryByText(/You have gingivitis/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Teeth whitening › Timeline" })).toHaveAttribute("href", "https://example.org/w");
    expect(screen.queryByText(/Veneers › Cost/)).not.toBeInTheDocument();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toMatchObject({ question: "what is this?", scan_id: "s1", history: [] });
  });

  it("shows the server's error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(sseResponse([["error", { code: "rate_limited", message: "Too many requests." }]]));
    render(<ChatPanel />);
    await userEvent.type(screen.getByLabelText("Your question"), "hello there");
    await userEvent.click(screen.getByLabelText("Send"));
    await waitFor(() => expect(screen.getByText("Too many requests.")).toBeInTheDocument());
  });
});

const plan: Plan = {
  id: "p1",
  scan_id: "s1",
  status: "pending_review",
  draft: {
    steps: [
      { code: "EXAM", quantity: 1, rationale: "Confirm in person.", citations: [1] },
      { code: "BONDING", quantity: 2, rationale: "Small chips.", citations: [2] },
    ],
    alternatives: [{ code: "VENEER", quantity: 2, rationale: "Longer lasting.", citations: [2] }],
    patient_summary: "Draft pending your dentist's review.",
  },
  estimate: {
    clinic: "Brightside Dental",
    currency: "USD",
    lines: [
      { code: "EXAM", name: "Comprehensive dental examination", quantity: 1, unit: "visit", low: 75, high: 200 },
      { code: "BONDING", name: "Composite bonding", quantity: 2, unit: "tooth", low: 600, high: 1200 },
    ],
    total_low: 675,
    total_high: 1400,
    note: "Indicative only.",
  },
  evidence: [
    { n: 1, chunk_id: "a#1", title: "Prevention", heading: "Check-ups", text: "…", url: null },
    { n: 2, chunk_id: "b#1", title: "Composite bonding", heading: "What it is", text: "…", url: "https://example.org/b" },
  ],
  path: ["gate", "retrieve", "draft", "validate", "estimate"],
  review_notes: null,
  updated_at: "2026-11-01T00:00:00Z",
};

describe("CarePlanCard", () => {
  it("renders ordered steps with citation anchors, alternatives and the cost range", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { code: "EXAM", name: "Comprehensive dental examination", unit: "visit", duration: "1 visit" },
        { code: "BONDING", name: "Composite bonding", unit: "tooth", duration: "1 visit" },
        { code: "VENEER", name: "Porcelain veneer", unit: "tooth", duration: "2-3 visits" },
      ]),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CarePlanCard plan={plan} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Porcelain veneer")).toBeInTheDocument(); // alternatives aren't priced but are named
    expect(screen.getByText("Awaiting dentist review")).toBeInTheDocument();
    expect(screen.getByText("Composite bonding", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "[2]" })[0]).toHaveAttribute("href", "#evidence-2");
    expect(screen.getByText("Alternatives to discuss")).toBeInTheDocument();
    expect(screen.getByText(/\$675\s–\s\$1,400/)).toBeInTheDocument();
  });
});

describe("screening panels", () => {
  it("escalation banner lists the reasons", () => {
    render(<TriageBanner triage={{ level: "see_dentist", reasons: ["Possible soft-tissue change (tongue)."] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Please see a dentist");
    expect(screen.getByText("Possible soft-tissue change (tongue).")).toBeInTheDocument();
  });

  it("findings show confidence and the screening disclaimer", () => {
    const findings: Scan["findings"] = {
      image_quality: "good",
      teeth_visible: true,
      quality_issues: [],
      summary: "Mild yellowing.",
      observations: [{ category: "discoloration", severity: "mild", confidence: 0.72, location: "upper teeth", evidence: "Yellow tint." }],
    };
    render(<FindingsList findings={findings} />);
    expect(screen.getByText("Discoloration")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis/)).toBeInTheDocument();
  });
});
