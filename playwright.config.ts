import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Add your custom playwright configuration overrides here
// Example:
// timeout: 60000,
// use: {
//   baseURL: 'http://localhost:3000',
// },
const overrides: PlaywrightTestConfig = {};

// Inside Lovable's sandbox the agent config package is provided by the
// environment. It is not published to npm (the registry entry is an empty
// placeholder), so outside Lovable — GitHub Actions, local checkouts — fall
// back to a plain Playwright config with the same entry points.
async function loadConfig() {
  try {
    const { createLovableConfig } = await import("lovable-agent-playwright-config/config");
    return createLovableConfig(overrides);
  } catch {
    return defineConfig({
      testDir: "./tests",
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: 0,
      reporter: "list",
      use: {
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:4173",
        trace: "off",
      },
      projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
      ...overrides,
    });
  }
}

export default await loadConfig();
