/**
 * Browser shim for Node's `node:assert` / `node:assert/strict` module.
 *
 * Implements the strict subset used by the unit tests. The default export is a
 * callable assertion function with the common helpers attached.
 */

class AssertionError extends Error {
  constructor(message) {
    super(message || "Assertion failed");
    this.name = "AssertionError";
  }
}

function assert(value, message) {
  if (!value) {
    throw new AssertionError(message || `Expected value to be truthy, got: ${stringify(value)}`);
  }
}

function stringify(value) {
  try {
    if (typeof value === "bigint") return `${value}n`;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deepEqualValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqualValue(a[k], b[k]));
  }
  return false;
}

assert.ok = function ok(value, message) {
  assert(value, message);
};

assert.equal = function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(message || `Expected ${stringify(actual)} === ${stringify(expected)}`);
  }
};

assert.strictEqual = assert.equal;

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual === expected) {
    throw new AssertionError(message || `Expected ${stringify(actual)} !== ${stringify(expected)}`);
  }
};

assert.notStrictEqual = assert.notEqual;

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!deepEqualValue(actual, expected)) {
    throw new AssertionError(message || `Expected deep equality of ${stringify(actual)} and ${stringify(expected)}`);
  }
};

assert.deepStrictEqual = assert.deepEqual;

assert.fail = function fail(message) {
  throw new AssertionError(message || "Failed");
};

assert.throws = function throws(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new AssertionError(message || "Expected function to throw");
};

assert.AssertionError = AssertionError;
assert.strict = assert;

module.exports = assert;
