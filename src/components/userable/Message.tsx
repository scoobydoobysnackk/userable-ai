import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

import {
  Attachment,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Message as AiMessage,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";

export type MessageImage = {
  dataUrl: string;
  mimeType: string;
  name: string;
};

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

export function Message({
  role,
  content,
  images = [],
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  images?: MessageImage[] | undefined;
  streaming?: boolean;
}) {
  const segments = parseSegments(content);

  if (role === "user") {
    return (
      <AiMessage from="user">
        {images.length > 0 && (
          <Attachments className="max-w-full" variant="grid">
            {images.map((image) => (
              <Attachment
                data={{
                  type: "file",
                  url: image.dataUrl,
                  mediaType: image.mimeType,
                  filename: image.name,
                  id: image.dataUrl.slice(-32),
                }}
                key={`${image.name}-${image.dataUrl.slice(-16)}`}
              >
                <AttachmentPreview />
              </Attachment>
            ))}
          </Attachments>
        )}
        {content && (
          <MessageContent className="border border-border bg-secondary text-secondary-foreground whitespace-pre-wrap">
            {content}
          </MessageContent>
        )}
      </AiMessage>
    );
  }

  return (
    <AiMessage from="assistant" className="max-w-full">
      <MessageContent className="w-full">
        {segments.length === 0 && streaming ? (
          <Shimmer className="font-mono text-sm">Thinking...</Shimmer>
        ) : (
          segments.map((segment, i) =>
            segment.type === "code" ? (
              <CodeBlock key={i} code={segment.content} />
            ) : (
              <MessageResponse className="text-sm leading-relaxed" key={i}>
                {segment.content}
              </MessageResponse>
            ),
          )
        )}
      </MessageContent>
    </AiMessage>
  );
}
