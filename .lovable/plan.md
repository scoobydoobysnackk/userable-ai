# Add image attachments and fix chat scrolling

## What will change
- Add an image attachment control beside the message box, with thumbnail previews and a remove action before sending.
- Send attached images with the conversation so Userable can inspect screenshots and answer about them alongside the typed prompt.
- Show attached images inside the user's sent message for clear conversation history.
- Replace page-level auto-scrolling with a dedicated chat scroller that only follows new output when the user is already near the bottom.
- Keep the message box fixed within the app layout without covering the final message, so the bottom is always reachable.
- Add a dark, compact scrollbar across the chat and code areas instead of the browser's white scrollbar.

## Guardrails
- Accept common image formats only, cap image size/count before sending, and show a concise validation error.
- Preserve normal text-only chat and streamed responses.
- Keep the existing dark terminal design and mobile behavior.

## Technical details
- Represent user messages with optional image data URLs in the browser, then translate them server-side into the AI gateway's multimodal `input_text` and `input_image` content parts.
- Validate request shape and image MIME/data length at the chat endpoint before forwarding it.
- Use an internal `overflow-y-auto` message region plus near-bottom detection instead of `scrollIntoView` on the document.
- Update project architecture notes for the multimodal message format.

## Verification
- Confirm the app builds without errors.
- Exercise text-only chat, image selection/removal, image-plus-text submission, and long-conversation scrolling.
- Check desktop and mobile-sized views for reachable content, visible image previews, and dark scrollbars.
