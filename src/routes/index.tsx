import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ImagePlus, Terminal, Zap } from "lucide-react";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Message, type MessageImage } from "@/components/userable/Message";

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

type ChatMessage = { role: "user" | "assistant"; content: string; images?: MessageImage[] };

const EXAMPLES = [
  "Hide all YouTube Shorts and autoplay suggestions",
  "Add keyboard shortcuts for 2x speed on any HTML5 video",
  "Auto-expand every 'show more' on a page and copy all text",
  "Dark mode injector with a Tampermonkey menu toggle",
];

function Userable() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = async (text: string, images: MessageImage[] = []) => {
    const prompt = text.trim();
    if ((!prompt && images.length === 0) || streaming) return;
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: prompt, images };
    const history: ChatMessage[] = [...messages, userMessage];
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

  const submit = async ({ text, files }: PromptInputMessage) => {
    const images = files.flatMap<MessageImage>((file) => {
      if (!file.url || !file.mediaType?.startsWith("image/")) return [];
      return [{ dataUrl: file.url, mimeType: file.mediaType, name: file.filename ?? "image" }];
    });
    await send(text, images);
  };

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden">
      <div className="scan-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-20 shrink-0 border-b border-border/70 bg-background/70 backdrop-blur">
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

      <Conversation className="relative z-10 min-h-0 w-full">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-7 px-4 py-8">
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
                  <Button
                    key={example}
                    onClick={() => send(example)}
                    variant="outline"
                    className="group h-auto min-h-20 justify-start whitespace-normal border-border bg-card/70 p-4 text-left hover:border-primary/50 hover:bg-card"
                  >
                    <span className="self-start font-mono text-[11px] text-primary">$</span>
                    <span className="text-sm text-foreground/85 group-hover:text-foreground">
                      {example}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            {messages.map((message, i) => (
              <Message
                key={i}
                role={message.role}
                content={message.content}
                images={message.images}
                streaming={streaming && i === messages.length - 1}
              />
            ))}
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="bottom-3 z-20 border-border bg-card" />
      </Conversation>

      <div className="relative z-20 shrink-0 border-t border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <PromptInput
            accept="image/png,image/jpeg,image/webp,image/gif"
            maxFiles={4}
            maxFileSize={5 * 1024 * 1024}
            multiple
            onError={({ code }) => {
              setError(
                code === "max_files"
                  ? "Attach up to 4 images at a time."
                  : code === "max_file_size"
                    ? "Each image must be 5 MB or smaller."
                    : "Choose a PNG, JPG, WEBP, or GIF image.",
              );
            }}
            onSubmit={submit}
            className="[&_[data-slot=input-group]]:rounded-lg [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-panel [&_[data-slot=input-group]]:focus-within:border-primary/60"
          >
            <ComposerAttachments />
            <PromptInputTextarea
              disabled={streaming}
              placeholder="e.g. block every ad container on a site and remember the toggle state..."
              className="min-h-14 px-3 font-mono text-sm placeholder:text-muted-foreground/70"
            />
            <PromptInputFooter>
              <PromptInputTools>
                <AttachmentButton />
              </PromptInputTools>
              <span className="font-mono text-[11px] text-muted-foreground">
                enter to send · shift+enter for newline
              </span>
              <PromptInputSubmit
                className="ml-auto"
                onStop={stop}
                status={streaming ? "streaming" : error ? "error" : "ready"}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function AttachmentButton() {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputButton
      aria-label="Attach images"
      onClick={attachments.openFileDialog}
      tooltip="Attach images"
    >
      <ImagePlus className="size-4" />
    </PromptInputButton>
  );
}

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <div className="order-first w-full px-3 pt-3">
      <Attachments className="mr-auto" variant="grid">
        {attachments.files.map((file) => (
          <Attachment data={file} key={file.id} onRemove={() => attachments.remove(file.id)}>
            <AttachmentPreview />
            <AttachmentRemove className="opacity-100" />
          </Attachment>
        ))}
      </Attachments>
    </div>
  );
}
