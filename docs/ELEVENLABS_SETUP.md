# ElevenLabs Setup

Этап 2 выполняет реальные backend-запросы только для проверки ключа, списка голосов и списка моделей.

Используемые endpoints, проверено 2026-08-03 по официальной документации:

- `GET /v1/user` для проверки API key;
- `GET /v2/voices?page_size=100&include_total_count=false` для списка голосов;
- `GET /v1/models` для списка моделей.

Agent lifecycle endpoints:

- `POST /v1/convai/agents/create`;
- актуальный `GET` endpoint агента;
- `PATCH /v1/convai/agents/{agent_id}`;
- `GET /v1/convai/conversation/token?agent_id=...`;
- fallback для signed URL: `GET /v1/convai/conversation/get-signed-url?agent_id=...`.

Frontend SDK:

- package: `@elevenlabs/react@0.7.1`;
- private WebRTC session: `startSession({ conversationToken, connectionType: "webrtc" })`;
- signed URL fallback: `startSession({ signedUrl, connectionType: "websocket" })`;
- callbacks: `onConnect`, `onDisconnect`, `onMessage`, `onError`, `onModeChange`, `onStatusChange`, `onDebug`, `onUnhandledClientToolCall`.
