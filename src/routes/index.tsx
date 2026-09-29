import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Terminal, Zap } from "lucide-react";

import { Message } from "@/components/userable/Message";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Userable — AI Userscript Generator for Tampermonkey" },
      {
        name: "description",
        content:
          "Userable writes complete, install-ready Tampermonkey userscripts from a plain-English description. No snippets, no lectures.",
      },
      { property: "og:title", content: "Userable — AI Userscript Generator" },
      {
        property: "og:description",
        content:
          "Describe any userscript and get a full Tampermonkey-ready .user.js file, metadata block included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Userable,
});

type ChatMessage = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "Hide all YouTube Shorts and autoplay suggestions",
  "Add keyboard shortcuts for 2x speed on any HTML5 video",
  "Auto-expand every 'show more' on a page and copy all text",
  "Dark mode injector with a Tampermonkey menu toggle",
];

function Userable() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendDelta = (delta: string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + delta };
        }
        return next;
      });
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.error === "string" && payload.error.length < 400
            ? payload.error
            : "Userable couldn't reach the AI service. Try again in a moment.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                appendDelta(event.delta);
              } else if (event.type === "error" || event.type === "response.failed") {
                throw new Error(event.message ?? "The AI stream failed.");
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
                if (!(parseError instanceof SyntaxError)) throw parseError;
              }
            }
          }
        }
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.content.trim() === "") {
          setError("Userable returned an empty response. Try rephrasing your request.");
          return prev.slice(0, -1);
        }
        return prev;
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content.trim() === "") return prev.slice(0, -1);
          return prev;
        });
      } else {
        setError((err as Error).message);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content.trim() === "") return prev.slice(0, -1);
          return prev;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="scan-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 border-b border-border/70 bg-background/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary shadow-glow">
              <Terminal className="size-4.5" />
            </div>
            <div>
              <h1 className="font-mono text-base font-bold tracking-tight text-foreground">
                Userable<span className="text-primary">_</span>
              </h1>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                userscript forge
              </p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
            <Zap className="size-3 text-accent" />
            Tampermonkey ready
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {messages.length === 0 ? (
          <div className="mt-6 space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-glow sm:text-4xl">
                Describe a userscript.
                <br />
                <span className="text-primary">Get the whole file.</span>
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                Userable writes complete, install-ready userscripts — metadata block, GM grants,
                SPA-safe DOM handling — then hands you a one-click{" "}
                <code className="font-mono text-accent">.user.js</code> download for Tampermonkey.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => send(example)}
                  className="group rounded-lg border border-border bg-card/70 p-4 text-left transition-colors hover:border-primary/50 hover:bg-card"
                >
                  <span className="font-mono text-[11px] text-primary">$</span>
                  <p className="mt-1 text-sm text-foreground/85 group-hover:text-foreground">
                    {example}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            {messages.map((message, i) => (
              <Message
                key={i}
                role={message.role}
                content={message.content}
                streaming={streaming && i === messages.length - 1}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </main>

      <div className="sticky bottom-0 z-10 border-t border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="rounded-xl border border-border bg-card p-2 shadow-panel focus-within:border-primary/60"
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="e.g. block every ad container on a site and remember the toggle state..."
              className="max-h-40 w-full resize-none bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                enter to send · shift+enter for newline
              </span>
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs text-secondary-foreground transition-colors hover:bg-muted"
                >
                  <Square className="size-3.5" />
                  stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  aria-label="Generate userscript"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
