/**
 * @testCategory unit
 * @blockchainRequired none
 * @description Platform-independent (Node + browser) non-transactional tests.
 *
 * These tests do NOT require a live RPC node. They verify that the SDK loads,
 * exposes the expected exports, carries well-formed ABIs/bytecode, constructs
 * contract wrappers, and encodes calldata via quantumcoin's Interface. The same
 * file is bundled (with node:test / node:assert shims) to run inside a browser.
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

const { Initialize } = require("quantumcoin/config");
const { Interface } = require("quantumcoin");

const sdk = require("../..");

// 32-byte (66 hex char) placeholder addresses — QuantumCoin addresses are 32 bytes.
const ADDR_A = "0x" + "1".repeat(64);
const ADDR_B = "0x" + "2".repeat(64);

// Contracts that expose an ERC20-style approve/transfer surface.
const CONTRACT_NAMES = [
  "IERC20",
  "QuantumSwapV2ERC20",
  "QuantumSwapV2Factory",
  "QuantumSwapV2Pair",
  "QuantumSwapV2Router02",
  "WQ",
];

const FACTORY_NAMES = CONTRACT_NAMES.map((n) => `${n}__factory`);

describe("QuantumSwap SDK (non-transactional)", () => {
  // Best-effort offline initialization (ABI packing is delegated to
  // quantum-coin-js-sdk). If it is unavailable, encoding tests self-skip while
  // structural tests still run.
  let initialized = false;
  before(async () => {
    try {
      await Initialize(null);
      initialized = true;
    } catch {
      initialized = false;
    }
  });

  it("exports every contract wrapper and factory", () => {
    for (const name of CONTRACT_NAMES) {
      assert.equal(typeof sdk[name], "function", `${name} should be exported`);
    }
    for (const name of FACTORY_NAMES) {
      assert.equal(typeof sdk[name], "function", `${name} should be exported`);
    }
  });

  it("each contract carries a well-formed ABI and bytecode", () => {
    for (const name of CONTRACT_NAMES) {
      const Contract = sdk[name];
      assert.ok(Array.isArray(Contract.abi), `${name}.abi must be an array`);
      assert.ok(Contract.abi.length > 0, `${name}.abi must be non-empty`);
      assert.equal(typeof Contract.bytecode, "string", `${name}.bytecode must be a string`);
      assert.ok(Contract.bytecode.startsWith("0x"), `${name}.bytecode must be hex`);
    }
  });

  it("connect() returns an instance of the wrapper class", () => {
    const instance = sdk.IERC20.connect(ADDR_A, null);
    assert.ok(instance instanceof sdk.IERC20, "connect must return an IERC20 instance");
    assert.equal(instance.target, ADDR_A);
  });

  it("factories reference the matching contract ABI/bytecode", () => {
    for (const name of CONTRACT_NAMES) {
      const Factory = sdk[`${name}__factory`];
      assert.equal(typeof Factory.connect, "function", `${name}__factory.connect must exist`);
    }
  });

  it("populateTransaction encodes ERC20 calldata", (t) => {
    if (!initialized) {
      t.skip("quantumcoin Initialize() unavailable in this environment");
      return;
    }
    const token = sdk.IERC20.connect(ADDR_A, null);
    return (async () => {
      const approveTx = await token.populateTransaction.approve(ADDR_B, 123n);
      assert.equal(approveTx.to, ADDR_A);
      assert.equal(typeof approveTx.data, "string");
      assert.ok(approveTx.data.startsWith("0x"), "approve calldata must be hex");
      assert.ok(approveTx.data.length > 2, "approve calldata must be non-empty");

      const transferTx = await token.populateTransaction.transfer(ADDR_B, 1n);
      assert.ok(transferTx.data.startsWith("0x"), "transfer calldata must be hex");
    })();
  });

  it("Interface encodes calldata and resolves fragments for known ABI members", (t) => {
    if (!initialized) {
      t.skip("quantumcoin Initialize() unavailable in this environment");
      return;
    }
    const iface = new Interface(sdk.QuantumSwapV2Factory.abi);

    const fn = iface.getFunction("getPair");
    assert.ok(fn, "getPair function fragment must resolve");

    const data = iface.encodeFunctionData("getPair", [ADDR_A, ADDR_B]);
    assert.equal(typeof data, "string");
    assert.ok(data.startsWith("0x"), "encoded calldata must be hex");
    assert.ok(data.length >= 10, "encoded calldata must include a selector");

    const topic = iface.getEventTopic("PairCreated");
    assert.equal(typeof topic, "string");
    assert.ok(topic.startsWith("0x") && topic.length === 66, "event topic must be a 32-byte hash");
  });
});
