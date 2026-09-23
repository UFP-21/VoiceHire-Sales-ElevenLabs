# VoiceHire Sales AI

VoiceHire Sales AI is a bilingual RU/EN portfolio demo of a voice AI sales agent for a fictional recruiting product. The app lets a user validate a restricted ElevenLabs API key, select a real voice, create or update a Conversational AI agent, run a realtime voice call, and review a locally drafted demo request.

The demo is designed to show a production-minded integration pattern without storing secrets or adding CRM, database, calendar, SMS, email, or authentication layers.

## What It Demonstrates

- Bilingual RU/EN UI and sales conversation flow.
- Native Russian and English agent prompts, not a literal UI-only translation.
- ElevenLabs Conversational AI agent lifecycle through a backend proxy.
- React realtime conversation with `@elevenlabs/react`.
- Restricted API key validation through the allowed voices endpoint.
- Real voice selection after key validation.
- Local lead extraction from the user transcript after the conversation ends.
- Safe technical log that never displays API keys, conversation tokens, or raw private config.
- Mock mode and automated tests without paid/live ElevenLabs calls.

## Architecture

```text
Browser
  React + Vite UI
  @elevenlabs/react realtime session
  sessionStorage: API key only
  localStorage: locale, agent id, voice id, non-secret preferences
        |
        | /api/* with X-ElevenLabs-Api-Key
        v
Express Backend
  validation, agent ensure/update, conversation token
  safe error mapping and secret redaction
        |
        | xi-api-key, no key logging
        v
ElevenLabs API
  GET /v2/voices
  GET /v1/convai/agents
  GET /v1/convai/agents/:agent_id
  POST /v1/convai/agents/create
  PATCH /v1/convai/agents/:agent_id
  GET /v1/convai/conversation/token
  fallback GET /v1/convai/conversation/get-signed-url
```

Production runs as one Node process: the backend serves `/api/*` and the built frontend from `backend/frontend-dist`.

## Security Model

The user enters their own ElevenLabs API key in the browser settings modal.

- The key is kept only in `sessionStorage`.
- The key is sent only to the backend as `X-ElevenLabs-Api-Key`.
- The backend forwards it to ElevenLabs as `xi-api-key`.
- The key is not saved by the backend, not written to logs, and not required as a Replit Secret.
- Conversation tokens and signed URLs are never displayed in the technical log.

Recommended restricted key permissions for live testing:

- ElevenAgents: Write
- Voices: Read
- Other permissions: No Access unless you intentionally extend the app

## Local Commands

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e --workspace frontend
```

Development:

```bash
npm run dev:backend
npm run dev:frontend -- -- --port 5174 --strictPort
```

Backend: `http://localhost:8000`
Frontend: `http://localhost:5174`

Production smoke:

```bash
npm run build
$env:NODE_ENV="production"; $env:PORT="8000"; npm run start --workspace backend
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

## Replit

The project is prepared for Replit but is not deployed automatically.

Build command:

```bash
bash scripts/replit-build.sh
```

Run command:

```bash
bash scripts/replit-start.sh
```

The Replit app should expose the backend port through `process.env.PORT`; the backend listens on `0.0.0.0`.

## Manual Live Test Flow

1. Open settings.
2. Enter a restricted ElevenLabs key.
3. Validate the key.
4. Select one of the real voices returned by ElevenLabs.
5. Keep `eleven_turbo_v2_5` as the default TTS model unless you know another compatible model.
6. Create or update the AI agent.
7. Start the call.
8. End the call and review the local demo request draft.
9. Save the request manually if the extracted data looks correct.

The app never submits the lead automatically.

## User Guide

The full bilingual operator guide is available in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Contribution Draft

Implemented a bilingual RU/EN VoiceHire Sales AI demo on top of an existing ElevenLabs realtime voice-agent pipeline. Added locale detection, persisted manual language switching, localized UI/settings/errors/log presentation/lead form, language-specific sales prompts and first messages, English and Russian mock call scenarios, transcript-based lead extraction for both languages, stricter live voice validation, safer backend error localization, and regression coverage for locale switching, prompt selection, lead extraction, and secret redaction. Preserved the existing backend proxy, React SDK realtime session, restricted-key validation flow, and production static frontend serving.
