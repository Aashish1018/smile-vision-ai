import { describe, expect, it } from "vitest";
import { parseSSE } from "./sse";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(enc.encode(c)));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const m of parseSSE(stream)) out.push(m);
  return out;
}

describe("parseSSE", () => {
  it("parses named events", async () => {
    const msgs = await collect(streamOf('event: stage\ndata: {"stage":"screening"}\n\n'));
    expect(msgs).toEqual([{ event: "stage", data: '{"stage":"screening"}' }]);
  });

  it("reassembles events split across chunks", async () => {
    const msgs = await collect(streamOf("event: tok", "en\ndata: hel", "lo\n\nevent: done\nda", "ta: {}\n\n"));
    expect(msgs.map((m) => m.event)).toEqual(["token", "done"]);
    expect(msgs[0].data).toBe("hello");
  });

  it("handles CRLF, comments/pings and multi-line data", async () => {
    const msgs = await collect(streamOf(": ping\r\n\r\nevent: x\r\ndata: a\r\ndata: b\r\n\r\n"));
    expect(msgs).toEqual([{ event: "x", data: "a\nb" }]);
  });

  it("defaults the event name and flushes a trailing block", async () => {
    const msgs = await collect(streamOf("data: last"));
    expect(msgs).toEqual([{ event: "message", data: "last" }]);
  });
});
