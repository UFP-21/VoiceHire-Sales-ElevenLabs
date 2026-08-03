# VoiceHire Sales AI

Демонстрационное приложение для домашнего задания по голосовым AI-агентам: AI-продажник VoiceHire AI через ElevenLabs ElevenAgents Realtime.

## Статус

Сейчас реализованы Этапы 1-7, кроме live-проверок с реальным ключом:

- React + TypeScript + Vite;
- Express + TypeScript;
- shared contracts;
- базовый русский UI;
- reducer/state machine;
- MockElevenLabsAdapter;
- `/api/health`;
- unit tests;
- заготовки Docker и Replit.
- backend safety endpoints для ElevenLabs:
  - `POST /api/elevenlabs/validate-key`;
  - `GET /api/elevenlabs/voices`;
  - `GET /api/elevenlabs/models`;
- fixed ElevenLabs base URL;
- timeout, no-store, request ID, body limit, rate limit;
- безопасный формат ошибок и redaction секретов.
- agent lifecycle:
  - `POST /api/elevenlabs/agents/ensure`;
  - `POST /api/elevenlabs/agents/get`;
  - `PATCH /api/elevenlabs/agents/:agentId`;
- conversation token endpoint:
  - `POST /api/elevenlabs/conversation-token`;
- React SDK `@elevenlabs/react` для Realtime-сессии;
- mock E2E flow для проверки без реального ключа;
- production Node server, который раздаёт frontend и backend из одного процесса.

Проверка ключа, voices, models, создание/обновление агента и получение token выполняются через backend. Реальный live-звонок нужно проверить вручную с настоящим ElevenLabs key.

## Команды

```bash
npm install
npm run typecheck
npm test
npm run build
npm run lint
npm run test:e2e --workspace frontend
npm run dev
```

Frontend dev server доступен на `http://localhost:5173`, backend на `http://localhost:8000`.

Production smoke:

```bash
npm run build
$env:NODE_ENV="production"; $env:PORT="8000"; npm run start --workspace backend
```

## Безопасность ключа

В учебном сценарии пользователь вводит собственный ElevenLabs API key. Ключ хранится только в `sessionStorage` браузера, отправляется только на backend в заголовке `X-ElevenLabs-Api-Key`, не сохраняется backend и не пишется в логи. Для реального production постоянный ключ следует хранить на доверенном backend в Secrets.

Mock mode доступен только для тестов: ключи с префиксом `mock` не вызывают ElevenLabs и используются в unit/E2E.

Минимальные права ключа для следующих этапов:

- ElevenAgents: Write;
- Voices: Read, если загружается список голосов;
- разумный лимит кредитов;
- остальные endpoints: No Access, если не используются.
