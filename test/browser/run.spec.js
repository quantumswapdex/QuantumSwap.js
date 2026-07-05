// @ts-check
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const distIndex = path.join(__dirname, "dist", "index.html");

test("QuantumSwap unit tests pass in the browser", async ({ page }) => {
  if (!fs.existsSync(distIndex)) {
    throw new Error(
      `Missing ${distIndex}. Run "npm run test:browser:build" first (or use "npm run test:browser").`,
    );
  }

  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(pathToFileURL(distIndex).href);

  await page.waitForFunction(() => Boolean(window.__TEST_RESULTS__), null, { timeout: 30000 });

  const results = await page.evaluate(() => window.__TEST_RESULTS__);

  if (results.failed > 0) {
    console.error("Browser test failures:\n" + results.errors.join("\n"));
  }

  expect(consoleErrors, `page errors: ${consoleErrors.join("; ")}`).toEqual([]);
  expect(results.failed, results.errors.join("; ")).toBe(0);
  expect(results.passed).toBeGreaterThan(0);
});
