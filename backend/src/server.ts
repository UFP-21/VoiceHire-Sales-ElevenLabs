import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8000);
const host = "0.0.0.0";

const app = createApp();

app.listen(port, host, () => {
  console.log(`VoiceHire Sales AI server listening on http://${host}:${port}`);
});
