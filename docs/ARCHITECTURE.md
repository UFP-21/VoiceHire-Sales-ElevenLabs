# Architecture

## Stage 1-7

Проект разделён на три workspace:

- `shared` содержит типы, состояния, storage keys и общие контракты API.
- `backend` содержит Express-приложение, middleware, health endpoint и `MockElevenLabsAdapter`.
- `backend` также содержит `ElevenLabsHttpAdapter` для безопасных запросов key validation, voices и models.
- `backend` содержит agent lifecycle, config hash, token/signed URL endpoint и production static frontend serve.
- `frontend` содержит React UI, reducer/state machine, backend client, `@elevenlabs/react` Realtime hook и mock flow для тестов.

Production backend будет раздавать `frontend/dist` из `backend/frontend-dist` и обслуживать `/api/*` из одного Node-процесса.

## Secret Handling

API key не хранится на backend, не пишется в логи и на Этапе 1 остаётся только в `sessionStorage`.

На Этапе 2 frontend отправляет key только в заголовке `X-ElevenLabs-Api-Key`. Backend проксирует его в ElevenLabs как `xi-api-key`, использует фиксированный `https://api.elevenlabs.io`, ставит `Cache-Control: no-store`, request ID, body limit, timeout и rate limit.

Conversation token/signed URL никогда не сохраняется и не пишется в технический лог.
