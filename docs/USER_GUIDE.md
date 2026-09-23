# VoiceHire Sales AI User Guide / Руководство пользователя

## English

### Before you begin

Open the application in a modern desktop browser and allow microphone access when the browser asks. The initial interface language is English. Use the `RU` or `EN` selector in the header before creating an agent if you want to change both the interface and the sales conversation language.

### Live call

1. Open **Settings**.
2. Enter your restricted ElevenLabs API key. The key is kept only for the current browser session.
3. Select **Validate key**. The application loads the voices available to that key.
4. Select a real voice. A voice with an ID starting with `mock_` cannot be used in live mode.
5. Keep `eleven_turbo_v2_5` as the TTS model unless you have verified another compatible model.
6. Select **Save**, then **Create AI agent**. Use **Update AI agent** after changing language, voice, or prompt.
7. Select **Call** and grant microphone access. Use mute or end the conversation when needed.
8. When the conversation ends, review the drafted demo request. Correct the name, contact, and comment if needed, then select **Save request**. The request is never submitted automatically.

### Language and safety

The language selector is unavailable during an active call. API keys, conversation tokens, and signed URLs are not displayed in the technical log. Use **Forget Agent ID** in Settings when you want the next setup to create a separate agent.

## Русский

### Перед началом работы

Откройте приложение в современном браузере на компьютере и разрешите доступ к микрофону, когда браузер его запросит. По умолчанию интерфейс открывается на английском языке. До создания агента выберите `RU` или `EN` в шапке: этот выбор меняет и интерфейс, и язык sales-разговора.

### Live-звонок

1. Откройте **Settings**.
2. Введите ограниченный API-ключ ElevenLabs. Ключ хранится только в текущей сессии браузера.
3. Нажмите **Validate key**. Приложение загрузит доступные этому ключу голоса.
4. Выберите реальный голос. Голос с ID, начинающимся на `mock_`, нельзя использовать в live-режиме.
5. Оставьте `eleven_turbo_v2_5` как TTS-модель, если совместимость другой модели не была проверена.
6. Нажмите **Save**, затем **Create AI agent**. После изменения языка, голоса или prompt используйте **Update AI agent**.
7. Нажмите **Call** и разрешите доступ к микрофону. При необходимости выключайте микрофон или завершайте разговор.
8. После завершения разговора проверьте черновик заявки на демо. При необходимости исправьте имя, контакт и комментарий, затем нажмите **Save request**. Заявка никогда не отправляется автоматически.

### Язык и безопасность

Переключатель языка недоступен во время активного звонка. API-ключи, conversation token и signed URL не выводятся в технический лог. Используйте **Forget Agent ID** в Settings, если при следующей настройке нужно создать отдельного агента.
