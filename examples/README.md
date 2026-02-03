# QuantumSwap SDK Examples

This folder is a **standalone package** that depends on the QuantumSwap SDK. Examples use `quantumswap` as a dependency instead of the parent repo.

## Setup

From this directory:

```bash
cd examples
npm install
```

This installs `quantumswap` (from the parent via `file:..`) and `quantumcoin`. You can run any example from the `examples/` folder.

## Running examples

- **Full DEX flow (pre-deployed WQ/Factory/Router, deploy tokens, pair, liquidity, swap):**  
  `npm run run-dex-flow` or `node run-dex-flow-custom.js` (JS) / `npx ts-node run-dex-flow-custom.ts` (TS).  
  Set `QC_RPC_URL` (default `http://127.0.0.1:8545`), optionally `QC_CHAIN_ID`, `QC_WALLET_JSON`, `QC_WALLET_PASSPHRASE`.

- **Contract-specific examples:**  
  Deploy: `node deploy-WQ.js`, `node deploy-QuantumSwapV2Factory.js`, etc.  
  Read/events/write/offline-signing: `node read-operations-WQ.js`, `node events-WQ.js`, etc.

## Package layout

- **package.json** — `quantumswap-examples` with dependency `quantumswap` (`file:..`) and `quantumcoin`.
- **\_test-wallet.js** — Default test wallet helper used by examples (requires `quantumcoin`).
- All example scripts `require("quantumswap")` for SDK types and factories.

## Using a published SDK

To use the published npm package instead of the local repo, in `examples/package.json` change:

```json
"quantumswap": "file:.."
```

to:

```json
"quantumswap": "^0.0.1"
```

Then run `npm install` in `examples/`.
