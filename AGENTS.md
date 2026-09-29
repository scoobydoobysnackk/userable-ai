<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- AI chat streaming lives in `src/routes/api/chat.ts` (Lovable AI Gateway `/v1/responses`, SSE forwarded to the client) — a raw server route is needed because `createServerFn` can't stream.
- The Userable system prompt lives in that route; keep it server-side so it can't be edited from the browser.
- Gateway run-ID helpers live in `src/lib/ai/run-id.ts` so request logs stay correlated across calls.
- Chat user messages may carry validated image data URLs, which the API translates into multimodal gateway content parts so screenshots stay usable across turns.
