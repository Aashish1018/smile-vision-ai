/**
 * Minimal Server-Sent Events parser for POST responses (EventSource only supports GET).
 * Handles events split across chunks, CRLF line endings, multi-line data and comment pings.
 */
export interface SSEMessage {
  event: string;
  data: string;
}

export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const message = parseBlock(block);
        if (message) yield message;
      }
      if (done) {
        const tail = parseBlock(buffer);
        if (tail) yield tail;
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): SSEMessage | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive ping
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
