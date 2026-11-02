import { useRef, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, streamPost, type ChatTurn } from "@/lib/api";

interface Citation {
  n: number;
  title: string;
  heading: string;
  url: string | null;
}

interface Message extends ChatTurn {
  citations?: Citation[];
  error?: boolean;
}

const SUGGESTIONS = ["How long does whitening last?", "Is bonding reversible?", "What should I ask my dentist?"];

export function ChatPanel({ scanId }: { scanId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    abort.current = new AbortController();

    const patchLast = (fn: (m: Message) => Message) =>
      setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

    try {
      await streamPost(
        "/api/chat",
        { question, history, scan_id: scanId ?? null },
        (event, data) => {
          if (event === "citations") patchLast((m) => ({ ...m, citations: data as Citation[] }));
          else if (event === "token") patchLast((m) => ({ ...m, content: m.content + (data as string) }));
          else if (event === "replace") patchLast((m) => ({ ...m, content: data as string }));
        },
        abort.current.signal,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      patchLast((m) => ({ ...m, content: message, error: true }));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <section className="dv-panel rounded-3xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-primary" />
        <h2 className="text-lg font-bold">Ask about your options</h2>
      </div>
      <p className="text-xs dv-muted">
        Answers come only from our cited dental knowledge base. Personal details are removed before anything reaches
        the model.
      </p>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => void ask(s)} className="text-xs rounded-full px-3 py-1.5 dv-panel-soft dv-hover">
              {s}
            </button>
          ))}
        </div>
      ) : (
        <ol className="space-y-3 max-h-[420px] overflow-y-auto pr-1" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 text-sm max-w-[85%]"
                    : `rounded-2xl rounded-bl-sm dv-panel-soft px-4 py-3 text-sm whitespace-pre-wrap ${m.error ? "text-red-500" : ""}`
                }
              >
                {m.content || <Loader2 size={14} className="animate-spin" />}
                {m.role === "assistant" && !m.error && m.content && m.citations && (
                  <ul className="mt-2 pt-2 border-t border-border/60 space-y-0.5 text-xs dv-muted">
                    {m.citations
                      .filter((c) => m.content.includes(`[${c.n}]`))
                      .map((c) => (
                        <li key={c.n}>
                          [{c.n}]{" "}
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-primary underline">
                              {c.title} › {c.heading}
                            </a>
                          ) : (
                            `${c.title} › ${c.heading}`
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={1000}
          aria-label="Your question"
        />
        <Button type="submit" size="icon" disabled={busy || input.trim().length < 2} aria-label="Send">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </Button>
      </form>
    </section>
  );
}
