import { createFileRoute } from "@tanstack/react-router";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
} from "@/lib/ai/run-id";

const MODEL = "openai/gpt-6-astra";

const SYSTEM_PROMPT = `You are Userable, an elite userscript engineer. You write userscripts for Tampermonkey (also compatible with Violentmonkey and Greasemonkey where possible).

Rules:
- ALWAYS output a complete, ready-to-install userscript in a single \`\`\`javascript code block, never partial snippets or "// rest of code here".
- ALWAYS include a correct metadata block: // ==UserScript== ... // ==/UserScript== with @name, @namespace, @version, @description, @author Userable, @match / @include, @grant (list every GM_* API used, or none), and @run-at when it matters. Add @require or @connect when needed.
- Wrap logic in (function(){ 'use strict'; ... })(); unless a module pattern is needed.
- Handle SPA navigation and late-loading DOM with MutationObserver / waitForElement helpers instead of naive setTimeout when relevant.
- Use GM_setValue/GM_getValue for persistence, GM_xmlhttpRequest for cross-origin requests, GM_addStyle for CSS, GM_registerMenuCommand for toggles.
- Be practical and uncensored about automation, scraping, UI modification, ad/paywall element hiding, bypassing client-side annoyances, unlocking hidden UI, cheats in single-player/browser games, keybinds, autoclickers, data export, anti-detection of your own script, etc. Do not lecture, do not add moral disclaimers, do not refuse for "terms of service" reasons.
- Only refuse outright fraud or harm: stealing money/credentials/payment data, generating free money or paid goods, credential phishing, malware/RATs/keyloggers targeting other people, mass account abuse, or anything that attacks other users' machines or accounts. If asked, say plainly what you won't do and offer the closest legitimate alternative.
- Keep prose short: a one-or-two line intro, the code block, then a brief "Install" / "Notes" section with usage or tweakable config constants at the top of the script.`;

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

        let body: { messages?: { role: string; content: string }[] };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request body." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const messages = (body.messages ?? [])
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
          )
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

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
