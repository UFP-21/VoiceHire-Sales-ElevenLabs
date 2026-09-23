# Architecture

## Workspaces

- `shared` contains API contracts, app states, storage keys, event names, and shared types.
- `backend` contains the Express app, safety middleware, ElevenLabs HTTP adapter, prompt content, agent lifecycle, and production static frontend serving.
- `frontend` contains the React UI, reducer/state machine, typed i18n dictionaries, backend client, lead extraction, `@elevenlabs/react` realtime hook, and mock flow.

## Runtime Flow

```text
React UI
  locale + settings + safe technical log
  sessionStorage API key
  localStorage locale/voice/agent metadata
        |
        v
Express /api/elevenlabs
  parse API key header
  rate limit + no-store + request id
  map ElevenLabs errors
        |
        v
ElevenLabs
  voices -> validation and voice list
  agents -> get/list/create/update
  conversation token -> WebRTC
  signed URL fallback -> WebSocket
```

## Realtime Session

The frontend starts conversations through `@elevenlabs/react` with either:

- `conversationToken` and `connectionType: "webrtc"`; or
- fallback `signedUrl` and `connectionType: "websocket"`.

Start/end/mute/timer/volume state remains in the frontend reducer. Locale switching is disabled while a call is active so the UI, prompt, and active agent configuration cannot diverge mid-call.

## Bilingual Layer

The UI uses a typed central dictionary in `frontend/src/i18n.ts`.

- Default locale: EN for every new browser session, regardless of the browser locale.
- Manual RU/EN selection is stored in `localStorage`.
- The same locale controls UI text, visible error text, settings labels, log messages, mock conversation text, lead extraction comment language, system prompt, and agent language.
- Backend first messages are selected from `backend/src/prompts/voicehireSalesPrompt.ts` based on `settings.language`.

## Secret Handling

API keys are never embedded in the project and are not required through Replit Secrets.

- Browser stores the user-entered key only in `sessionStorage`.
- Backend receives the key only through `X-ElevenLabs-Api-Key`.
- Backend sends it to ElevenLabs only as `xi-api-key`.
- Backend diagnostic logs intentionally omit API keys, request headers, and request bodies.
- Technical UI logs omit API keys, conversation tokens, signed URLs, and raw private config.

## Production Serving

In `NODE_ENV=production`, the backend serves the built frontend from `backend/frontend-dist` and serves API endpoints under `/api`.

The server binds to:

- host: `0.0.0.0`
- port: `process.env.PORT || 8000`
