import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const OIDC_MOCK_PORT = Number(process.env.OIDC_MOCK_PORT ?? 3199);
const OIDC_MOCK = `http://127.0.0.1:${OIDC_MOCK_PORT}`;

function providedChromium(): string | undefined {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(
    (path): path is string => Boolean(path),
  );
  return candidates.find((path) => existsSync(path));
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-GB",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Prefer a Chromium already provided by the environment. Falling back to
        // undefined lets Playwright use its own download where one exists.
        launchOptions: { executablePath: providedChromium() },
      },
    },
  ],
  // Reuse an already-running dev server locally; start one in CI.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
        {
          // A stand-in OpenID Connect provider for e2e/sso.spec.ts.
          command: "node e2e/oidc-mock.mjs",
          url: `${OIDC_MOCK}/health`,
          reuseExistingServer: !process.env.CI,
          env: { OIDC_MOCK_PORT: String(OIDC_MOCK_PORT), OIDC_CLIENT_ID: "brewcore-e2e", OIDC_CLIENT_SECRET: "e2e-client-secret" },
        },
        {
          command: "npm run start",
          url: `${baseURL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            /* The suite registers a fresh account per test. The default
               `bootstrap` mode closes registration after the first account -
               which is the point of it - so the suite opts into open
               registration, as NutriCore's does. The policy itself is covered
               by src/server/registration.test.ts. */
            REGISTRATION_MODE: "open",
            RATE_LIMIT_MULTIPLIER: process.env.RATE_LIMIT_MULTIPLIER ?? "50",
            PORT: String(PORT),
            APP_URL: process.env.APP_URL ?? baseURL,
            OIDC_ENABLED: "true",
            OIDC_ISSUER: `${OIDC_MOCK}/`,
            OIDC_CLIENT_ID: "brewcore-e2e",
            OIDC_CLIENT_SECRET: "e2e-client-secret",
          },
        },
      ],
});
