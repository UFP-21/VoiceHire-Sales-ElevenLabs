import { spawn } from "node:child_process";

const port = 5174;
const baseURL = `http://127.0.0.1:${port}`;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Vite server did not start at ${baseURL}`);
};

const run = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });

const vite = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: "ignore",
  shell: false
});

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await run(process.execPath, ["./node_modules/@playwright/test/cli.js", "test"], {
    env: { ...process.env, PW_SKIP_WEB_SERVER: "1" }
  });
} finally {
  vite.kill("SIGTERM");
  setTimeout(() => vite.kill("SIGKILL"), 1000).unref();
}

process.exit(exitCode);
