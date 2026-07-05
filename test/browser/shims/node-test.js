/**
 * Browser shim for Node's `node:test` module.
 *
 * Implements the small subset used by the unit tests (`describe`, `it`/`test`,
 * `before`) and exposes a runner via `globalThis.__NODE_TEST__.run()` that the
 * browser harness invokes. Tests are registered at import time; the harness
 * triggers execution afterwards.
 */

const suites = [];
let current = null;
let rootSuite = null;

function getRootSuite() {
  if (!rootSuite) {
    rootSuite = { name: "(root)", tests: [], befores: [] };
    suites.push(rootSuite);
  }
  return rootSuite;
}

function describe(name, fn) {
  const suite = { name: String(name), tests: [], befores: [] };
  suites.push(suite);
  const prev = current;
  current = suite;
  try {
    if (typeof fn === "function") fn();
  } finally {
    current = prev;
  }
}

function it(name, optsOrFn, maybeFn) {
  let fn = maybeFn;
  if (typeof optsOrFn === "function") fn = optsOrFn;
  const target = current || getRootSuite();
  target.tests.push({ name: String(name), fn });
}

function before(fn) {
  const target = current || getRootSuite();
  if (typeof fn === "function") target.befores.push(fn);
}

// No-ops / passthroughs for API completeness.
function after() {}
function beforeEach() {}
function afterEach() {}

async function run() {
  const results = { passed: 0, failed: 0, skipped: 0, errors: [] };
  for (const suite of suites) {
    for (const hook of suite.befores) {
      // eslint-disable-next-line no-await-in-loop
      await hook();
    }
    for (const testCase of suite.tests) {
      let skipped = false;
      const ctx = {
        skip(/* message */) {
          skipped = true;
        },
        diagnostic() {},
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        await testCase.fn(ctx);
        if (skipped) results.skipped++;
        else results.passed++;
      } catch (err) {
        results.failed++;
        const msg = err && err.message ? err.message : String(err);
        results.errors.push(`${suite.name} > ${testCase.name}: ${msg}`);
      }
    }
  }
  return results;
}

globalThis.__NODE_TEST__ = { run, suites };

const describeFn = describe;
describeFn.skip = describe;
const itFn = it;
itFn.skip = it;

module.exports = {
  describe: describeFn,
  it: itFn,
  test: itFn,
  before,
  after,
  beforeEach,
  afterEach,
  run,
};
