# Replit Deployment

Replit не требует Secrets для учебного режима: пользователь вводит собственный ElevenLabs key в браузере.

Build:

```bash
bash scripts/replit-build.sh
```

Run:

```bash
bash scripts/replit-start.sh
```

Сервер слушает `0.0.0.0` и использует `PORT`, если переменная задана.
