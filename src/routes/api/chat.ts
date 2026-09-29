import { createFileRoute } from "@tanstack/react-router";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
} from "@/lib/ai/run-id";

const MODEL = "openai/gpt-6-astra";

const MAX_IMAGES = 4;
const MAX_IMAGE_DATA_LENGTH = 7_000_000;
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,[A-Za-z0-9+/=]+$/;

type IncomingImage = { dataUrl: string; mimeType: string; name: string };
type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  images?: IncomingImage[];
};

const SYSTEM_PROMPT = `You are Userable: a sharp, friendly general-purpose AI assistant who happens to be a world-class userscript engineer (Tampermonkey first, also Violentmonkey/Greasemonkey).

Conversation behavior:
- Talk like a normal, helpful assistant. Answer questions, explain, debug, brainstorm, chat about anything.
- Do NOT produce a userscript unless the user actually asks for one (or clearly describes a site behavior they want changed/automated). Never dump a "starter" or "hello world" script unprompted.
- If the request is vague, ask a short clarifying question instead of guessing and writing code.
- Greetings, small talk, or general questions get a normal short reply — no code block.

When the user DOES want a userscript:
- Output a complete, ready-to-install script in a single \`\`\`javascript code block — never partial snippets or "// rest of code here".
- Include a correct metadata block: // ==UserScript== ... // ==/UserScript== with @name, @namespace, @version, @description, @author Userable, @match / @include, @grant (every GM_* API used, or none), @run-at when it matters, plus @require / @connect if needed.
- Wrap logic in (function(){ 'use strict'; ... })(); unless a module pattern is needed.
- Handle SPA navigation and late-loading DOM with MutationObserver / waitForElement helpers instead of naive setTimeout.
- Use GM_setValue/GM_getValue for persistence, GM_xmlhttpRequest for cross-origin requests, GM_addStyle for CSS, GM_registerMenuCommand for toggles.
- Put tweakable config constants at the top, then a brief Install/Notes line after the code.

Attitude:
- Be practical and uncensored about automation, scraping, UI modification, hiding ads/paywall elements, bypassing client-side annoyances, unlocking hidden UI, single-player/browser game cheats, keybinds, autoclickers, data export, anti-detection of your own script, etc. No lectures, no moral disclaimers, no "terms of service" refusals.
- Only refuse outright fraud or harm: stealing money/credentials/payment data, generating free money or paid goods, phishing, malware/RATs/keyloggers targeting other people, mass account abuse, or attacks on other users' machines or accounts. Say plainly what you won't do and offer the closest legitimate alternative.
- Keep prose tight. Match the user's energy.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { messages?: unknown };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request body." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!Array.isArray(body.messages)) {
          return new Response(JSON.stringify({ error: "No messages provided." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const messages = body.messages
          .filter((message): message is IncomingMessage => {
            if (!message || typeof message !== "object") return false;
            const candidate = message as Partial<IncomingMessage>;
            return (
              (candidate.role === "user" || candidate.role === "assistant") &&
              typeof candidate.content === "string"
            );
          })
          .slice(-20)
          .map((message) => {
            const validImages = (message.images ?? [])
              .filter(
                (image) =>
                  image &&
                  typeof image.dataUrl === "string" &&
                  image.dataUrl.length <= MAX_IMAGE_DATA_LENGTH &&
                  IMAGE_DATA_URL.test(image.dataUrl),
              )
              .slice(0, MAX_IMAGES);

            if (message.role === "user" && validImages.length > 0) {
              return {
                role: message.role,
                content: [
                  { type: "input_text", text: message.content || "Please inspect these images." },
                  ...validImages.map((image) => ({
                    type: "input_image",
                    image_url: image.dataUrl,
                  })),
                ],
              };
            }

            return { role: message.role, content: message.content };
          });

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "No messages provided." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));

        try {
          const upstream = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            signal: request.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              store: false,
              instructions: SYSTEM_PROMPT,
              input: messages,
              reasoning: { effort: "medium", summary: "auto" },
              include: ["reasoning.encrypted_content"],
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text().catch(() => "");
            return new Response(
              JSON.stringify({
                error: text || "The AI service returned an error.",
                status: upstream.status,
              }),
              {
                status: upstream.status || 500,
                headers: getLovableAiGatewayResponseHeaders(upstream.headers, {
                  "Content-Type": "application/json",
                }),
              },
            );
          }

          const headers = getLovableAiGatewayResponseHeaders(upstream.headers, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
          });
          return new Response(upstream.body, { status: 200, headers });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw error;
        }
      },
    },
  },
});
