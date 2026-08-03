import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
};

if (process.env.PW_SKIP_WEB_SERVER !== "1") {
  config.webServer = {
    command: "node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 120_000
  };
}

export default defineConfig(config);
