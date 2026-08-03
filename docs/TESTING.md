# Testing

## Automated

```bash
npm run typecheck
npm test
npm run build
npm run lint
npm run test:e2e --workspace frontend
```

Последний прогон:

- `npm run typecheck` — успешно;
- `npm test` — успешно, 20 тестов;
- `npm run build` — успешно;
- `npm run lint` — успешно;
- `npm run test:e2e --workspace frontend` — успешно, 1 mock E2E;
- production smoke на `PORT=8099` — `/api/health` 200, `/` 200;
- `docker compose config` — успешно.

Backend tests покрывают:

- safe error format;
- key header validation;
- secret redaction;
- voices/models normalization;
- ElevenLabs status mapping;
- timeout mapping;
- health endpoint no-store;
- idempotent mock agent ensure;
- real adapter agent create payload;
- conversation token signed URL fallback.

## Mock E2E

```bash
npm run test:e2e --workspace frontend
```

Сценарий mock-звонка покрывает ввод mock key, создание mock agent, старт разговора, mock transcript, mute/unmute и завершение.

## Live Conversations

Live-тесты не проводились: реальный ElevenLabs key пользователь не предоставлял, поэтому нельзя утверждать, что live-звонок реально состоялся.

Запланированные разговоры для финальной проверки:

1. HR-менеджер: десять вакансий в месяц, повторяющиеся первичные интервью, нужна стандартизация.
2. Собственник небольшой компании: редкий найм, сомневается в ценности, спрашивает цену.
3. Кадровое агентство: много однотипных скринингов, интерес к масштабированию, вопрос о финальном решении.
