// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Runs the bundled platform-independent unit tests inside a real browser.
 * Build the bundle first with `npm run test:browser:build`.
 */
module.exports = defineConfig({
  testDir: "./test/browser",
  testMatch: "run.spec.js",
  fullyParallel: false,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
