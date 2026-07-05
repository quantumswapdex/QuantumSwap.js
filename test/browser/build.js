/**
 * Bundles the platform-independent unit tests for execution in a browser.
 *
 * The same `test/unit/**.test.js` files that run under `node --test` are
 * bundled here with esbuild, aliasing Node's `node:test` / `node:assert`
 * modules to browser shims. The output is loaded by `index.html`, which the
 * Playwright spec drives.
 */

const path = require("node:path");
const fs = require("node:fs");
const esbuild = require("esbuild");

const rootDir = path.resolve(__dirname, "..", "..");
const unitDir = path.join(rootDir, "test", "unit");
const outDir = path.join(__dirname, "dist");
const shimsDir = path.join(__dirname, "shims");

function collectTestFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTestFiles(full));
    else if (entry.name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

async function main() {
  const testFiles = collectTestFiles(unitDir);
  if (testFiles.length === 0) {
    throw new Error(`No unit test files found under ${unitDir}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // A single entry that pulls in every unit test (registers them at import).
  const entryContents = testFiles
    .map((f) => `require(${JSON.stringify(f.split(path.sep).join("/"))});`)
    .join("\n");
  const entryPath = path.join(outDir, "_entry.js");
  fs.writeFileSync(entryPath, entryContents, "utf8");

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: path.join(outDir, "tests.js"),
    platform: "browser",
    format: "iife",
    target: "es2020",
    logLevel: "info",
    alias: {
      "node:test": path.join(shimsDir, "node-test.js"),
      "node:assert/strict": path.join(shimsDir, "node-assert.js"),
      "node:assert": path.join(shimsDir, "node-assert.js"),
    },
    define: {
      "process.env.QC_RPC_URL": "undefined",
    },
  });

  fs.copyFileSync(path.join(__dirname, "index.html"), path.join(outDir, "index.html"));

  console.log(`Bundled ${testFiles.length} unit test file(s) -> ${path.join(outDir, "tests.js")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
