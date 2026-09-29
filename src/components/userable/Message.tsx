import { useState } from "react";
import { Check, Copy, Download, Terminal, User } from "lucide-react";

type Segment = { type: "text" | "code"; content: string; lang?: string };

export function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: content.slice(last, match.index) });
    }
    segments.push({ type: "code", content: match[2] ?? "", lang: match[1] || "javascript" });
    last = re.lastIndex;
  }
  if (last < content.length) segments.push({ type: "text", content: content.slice(last) });
  return segments.filter((s) => s.content.trim().length > 0);
}

function scriptName(code: string) {
  const match = code.match(/@name\s+(.+)/);
  const raw = match?.[1]?.trim() ?? "userable-script";
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "userable-script"
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const isUserscript = code.includes("==UserScript==");

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scriptName(code)}.user.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-code">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {isUserscript ? "userscript" : "javascript"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            {copied ? "copied" : "copy"}
          </button>
          {isUserscript && (
            <button
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 font-mono text-xs text-primary transition-colors hover:bg-primary/25"
            >
              <Download className="size-3.5" />
              .user.js
            </button>
          )}
        </div>
      </div>
      <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[13px] leading-relaxed text-code-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {text
        .trim()
        .split(/\n{2,}/)
        .map((block, i) => (
          <p key={i}>
            {block.split(/(`[^`]+`)/g).map((part, j) =>
              part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
                <code
                  key={j}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-accent"
                >
                  {part.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{part.replace(/\*\*/g, "").replace(/^#+\s*/gm, "")}</span>
              ),
            )}
          </p>
        ))}
    </div>
  );
}

export function Message({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  const segments = parseSegments(content);

  if (role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-lg rounded-tr-none border border-border bg-secondary px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
          {content}
        </div>
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <User className="size-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
        <Terminal className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {segments.length === 0 && streaming ? (
          <p className="font-mono text-sm text-muted-foreground">
            compiling
            <span className="caret-blink">_</span>
          </p>
        ) : (
          segments.map((segment, i) =>
            segment.type === "code" ? (
              <CodeBlock key={i} code={segment.content} />
            ) : (
              <InlineText key={i} text={segment.content} />
            ),
          )
        )}
      </div>
    </div>
  );
}
