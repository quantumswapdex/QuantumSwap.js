# QuantumSwap

QuantumSwap.js SDK for DEX functionality in QuantumCoin blockchain

> **Note:** This is an experimental SDK. Use at your own risk.

## What’s in this package

- JavaScript contract wrappers and factories in `src/` (TypeScript types via `.d.ts`)
- Transactional tests in `test/e2e/`
- Example scripts in `examples/`

## Install

- `npm install`

## Build

- (no build step required)

## Run tests

- `npm test`

Transactional tests require:
- `QC_RPC_URL` (required for transactional tests)
- `QC_CHAIN_ID` (optional; defaults are used if omitted)

### Step by step walkthrough

This walkthrough uses **pre-deployed** WQ, V2 Factory, and Swap Router. Do **not** deploy these contracts; use the Test Release (Dec 2025) addresses below.

**Test Release (Dec 2025) Contracts**

| Variable | Address |
|----------|---------|
| `WQ_CONTRACT_ADDRESS` | `0x0E49c26cd1ca19bF8ddA2C8985B96783288458754757F4C9E00a5439A7291628` |
| `V2_CORE_FACTORY_CONTRACT_ADDRESS` | `0xbbF45a1B60044669793B444eD01Eb33e03Bb8cf3c5b6ae7887B218D05C5Cbf1d` |
| `SWAP_ROUTER_V2_CONTRACT_ADDRESS` | `0x41323EF72662185f44a03ea0ad8094a0C9e925aB1102679D8e957e838054aac5` |

**Steps**

1. **Connect** — Initialize the SDK, create a `JsonRpcProvider` with your RPC URL and chain ID, load a `Wallet` (e.g. from encrypted JSON or private key). Attach the SDK contract wrappers to the deployed addresses:
   - `WQ.connect(WQ_CONTRACT_ADDRESS, provider)` (or with signer for writes)
   - `QuantumSwapV2Factory.connect(V2_CORE_FACTORY_CONTRACT_ADDRESS, provider)`
   - `QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, signer)` for router calls

2. **Deploy two ERC20 tokens** — Deploy two tokens that have initial supply and mint to the deployer (e.g. a SimpleERC20-style contract: `constructor(name, symbol, initialSupply)`). Use `ContractFactory` with the token ABI and bytecode, then `getDeployTransaction(...)` and `sendTransaction({ ...tx, gasLimit })` so deployment has enough gas. Record `tokenA` and `tokenB` contract addresses.

3. **Create a pair** — Call `factory.createPair(tokenAAddress, tokenBAddress)` (with a signer). Wait for the tx. Get the pair address with `factory.getPair(tokenAAddress, tokenBAddress)`.

4. **Add liquidity** — Approve the router to spend tokenA and tokenB (e.g. `tokenA.approve(routerAddress, amountADesired)` and same for tokenB). Call `router.addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)` with a signer. Optionally verify pair reserves with `pair.getReserves()`.

5. **Swap token for token** — Approve the router to spend the input token. Call `router.swapExactTokensForTokens(amountIn, amountOutMin, [tokenIn, tokenOut], to, deadline)`. Check the recipient token balance before and after to confirm the swap.

6. **Swap ETH for token (optional)** — Wrap native currency: `wq.deposit({ value: amount })`. If there is no WQ–token pair yet, create it with `factory.createPair(wqAddress, tokenAddress)` and add liquidity via `router.addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline, { value: ethAmount })`. Then call `router.swapExactETHForTokens(amountOutMin, [wqAddress, tokenAddress], to, deadline, { value: ethValue })` to swap native ETH for the token.

Runnable scripts that perform all steps above:

- **JavaScript:** [examples/walkthrough-dex-full-flow.js](./examples/walkthrough-dex-full-flow.js)
- **TypeScript:** [examples/walkthrough-dex-full-flow.ts](./examples/walkthrough-dex-full-flow.ts)

Run with `QC_RPC_URL` set (and optionally `QC_CHAIN_ID`, or `QC_WALLET_JSON` + `QC_WALLET_PASSPHRASE` for your own wallet):

```bash
# JavaScript
QC_RPC_URL=http://your-rpc:8545 node examples/walkthrough-dex-full-flow.js

# TypeScript (requires typescript and ts-node: npm install -D typescript ts-node)
QC_RPC_URL=http://your-rpc:8545 npx ts-node examples/walkthrough-dex-full-flow.ts
```

The same flow is covered as an E2E test in [test/e2e/dex-full-flow.e2e.test.js](./test/e2e/dex-full-flow.e2e.test.js) (the test can optionally deploy WQ/Factory/Router when not using Test Release addresses).

## Examples

Examples are generated per contract (e.g. `examples/deploy-<Contract>.js`).

## Contracts

- [`IERC20`](#ierc20)
- [`QuantumSwapV2ERC20`](#quantumswapv2erc20)
- [`QuantumSwapV2Factory`](#quantumswapv2factory)
- [`QuantumSwapV2Pair`](#quantumswapv2pair)
- [`QuantumSwapV2Router02`](#quantumswapv2router02)
- [`WQ`](#wq)

## IERC20
- **Exports**: `IERC20`, `IERC20__factory`
- **Constructor**: `constructor()`
### Files
- [`src/IERC20.js`](./src/IERC20.js)
- [`src/IERC20__factory.js`](./src/IERC20__factory.js)
### Examples
- [deploy](./examples/deploy-IERC20.js)
- [read operations](./examples/read-operations-IERC20.js)
- [write operations](./examples/write-operations-IERC20.js)
- [events](./examples/events-IERC20.js)
### Tests
- [transactional test](./test/e2e/IERC20.e2e.test.js)
### Functions
- `allowance(address owner, address spender) view returns (uint256)`
- `approve(address spender, uint256 value) returns (bool)`
- `balanceOf(address owner) view returns (uint256)`
- `decimals() view returns (uint8)`
- `name() view returns (string)`
- `symbol() view returns (string)`
- `totalSupply() view returns (uint256)`
- `transfer(address to, uint256 value) returns (bool)`
- `transferFrom(address from, address to, uint256 value) returns (bool)`
### Events
- `Approval(address indexed owner, address indexed spender, uint256 value)`
- `Transfer(address indexed from, address indexed to, uint256 value)`
### Errors
- (none)
## QuantumSwapV2ERC20
- **Exports**: `QuantumSwapV2ERC20`, `QuantumSwapV2ERC20__factory`
- **Constructor**: `constructor()`
### Files
- [`src/QuantumSwapV2ERC20.js`](./src/QuantumSwapV2ERC20.js)
- [`src/QuantumSwapV2ERC20__factory.js`](./src/QuantumSwapV2ERC20__factory.js)
### Examples
- [deploy](./examples/deploy-QuantumSwapV2ERC20.js)
- [read operations](./examples/read-operations-QuantumSwapV2ERC20.js)
- [write operations](./examples/write-operations-QuantumSwapV2ERC20.js)
- [events](./examples/events-QuantumSwapV2ERC20.js)
### Tests
- [transactional test](./test/e2e/QuantumSwapV2ERC20.e2e.test.js)
### Functions
- `allowance(address, address) view returns (uint256)`
- `approve(address spender, uint256 value) returns (bool)`
- `balanceOf(address) view returns (uint256)`
- `decimals() view returns (uint8)`
- `name() view returns (string)`
- `symbol() view returns (string)`
- `totalSupply() view returns (uint256)`
- `transfer(address to, uint256 value) returns (bool)`
- `transferFrom(address from, address to, uint256 value) returns (bool)`
### Events
- `Approval(address indexed owner, address indexed spender, uint256 value)`
- `Transfer(address indexed from, address indexed to, uint256 value)`
### Errors
- (none)
## QuantumSwapV2Factory
- **Exports**: `QuantumSwapV2Factory`, `QuantumSwapV2Factory__factory`
- **Constructor**: `constructor(address _feeToSetter)`
### Files
- [`src/QuantumSwapV2Factory.js`](./src/QuantumSwapV2Factory.js)
- [`src/QuantumSwapV2Factory__factory.js`](./src/QuantumSwapV2Factory__factory.js)
### Examples
- [deploy](./examples/deploy-QuantumSwapV2Factory.js)
- [read operations](./examples/read-operations-QuantumSwapV2Factory.js)
- [write operations](./examples/write-operations-QuantumSwapV2Factory.js)
- [events](./examples/events-QuantumSwapV2Factory.js)
### Tests
- [transactional test](./test/e2e/QuantumSwapV2Factory.e2e.test.js)
### Functions
- `allPairs(uint256) view returns (address)`
- `allPairsLength() view returns (uint256)`
- `createPair(address tokenA, address tokenB) returns (address)`
- `feeTo() view returns (address)`
- `feeToSetter() view returns (address)`
- `getPair(address, address) view returns (address)`
- `INIT_CODE_HASH() view returns (bytes32)`
- `setFeeTo(address _feeTo)`
- `setFeeToSetter(address _feeToSetter)`
### Events
- `PairCreated(address indexed token0, address indexed token1, address pair, uint256)`
### Errors
- (none)
## QuantumSwapV2Pair
- **Exports**: `QuantumSwapV2Pair`, `QuantumSwapV2Pair__factory`
- **Constructor**: `constructor()`
### Files
- [`src/QuantumSwapV2Pair.js`](./src/QuantumSwapV2Pair.js)
- [`src/QuantumSwapV2Pair__factory.js`](./src/QuantumSwapV2Pair__factory.js)
### Examples
- [deploy](./examples/deploy-QuantumSwapV2Pair.js)
- [read operations](./examples/read-operations-QuantumSwapV2Pair.js)
- [write operations](./examples/write-operations-QuantumSwapV2Pair.js)
- [events](./examples/events-QuantumSwapV2Pair.js)
### Tests
- [transactional test](./test/e2e/QuantumSwapV2Pair.e2e.test.js)
### Functions
- `allowance(address, address) view returns (uint256)`
- `approve(address spender, uint256 value) returns (bool)`
- `balanceOf(address) view returns (uint256)`
- `burn(address to) returns (uint256, uint256)`
- `decimals() view returns (uint8)`
- `factory() view returns (address)`
- `getReserves() view returns (uint112, uint112, uint32)`
- `initialize(address _token0, address _token1)`
- `kLast() view returns (uint256)`
- `MINIMUM_LIQUIDITY() view returns (uint256)`
- `mint(address to) returns (uint256)`
- `name() view returns (string)`
- `price0CumulativeLast() view returns (uint256)`
- `price1CumulativeLast() view returns (uint256)`
- `skim(address to)`
- `swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)`
- `symbol() view returns (string)`
- `sync()`
- `token0() view returns (address)`
- `token1() view returns (address)`
- `totalSupply() view returns (uint256)`
- `transfer(address to, uint256 value) returns (bool)`
- `transferFrom(address from, address to, uint256 value) returns (bool)`
### Events
- `Approval(address indexed owner, address indexed spender, uint256 value)`
- `Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)`
- `Mint(address indexed sender, uint256 amount0, uint256 amount1)`
- `Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)`
- `Sync(uint112 reserve0, uint112 reserve1)`
- `Transfer(address indexed from, address indexed to, uint256 value)`
### Errors
- (none)
## QuantumSwapV2Router02
- **Exports**: `QuantumSwapV2Router02`, `QuantumSwapV2Router02__factory`
- **Constructor**: `constructor(address _factory, address _WETH)`
### Files
- [`src/QuantumSwapV2Router02.js`](./src/QuantumSwapV2Router02.js)
- [`src/QuantumSwapV2Router02__factory.js`](./src/QuantumSwapV2Router02__factory.js)
### Examples
- [deploy](./examples/deploy-QuantumSwapV2Router02.js)
- [read operations](./examples/read-operations-QuantumSwapV2Router02.js)
- [write operations](./examples/write-operations-QuantumSwapV2Router02.js)
- [events](./examples/events-QuantumSwapV2Router02.js)
### Tests
- [transactional test](./test/e2e/QuantumSwapV2Router02.e2e.test.js)
### Functions
- `addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)`
- `addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256, uint256, uint256)`
- `factory() view returns (address)`
- `getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) pure returns (uint256)`
- `getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256)`
- `getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[])`
- `getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])`
- `quote(uint256 amountA, uint256 reserveA, uint256 reserveB) pure returns (uint256)`
- `removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256)`
- `removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256, uint256)`
- `removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256)`
- `swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) payable returns (uint256[])`
- `swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])`
- `swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable`
- `swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])`
- `swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)`
- `swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])`
- `swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)`
- `swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])`
- `swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])`
- `WETH() view returns (address)`
### Events
- (none)
### Errors
- (none)
## WQ
- **Exports**: `WQ`, `WQ__factory`
- **Constructor**: `constructor()`
### Files
- [`src/WQ.js`](./src/WQ.js)
- [`src/WQ__factory.js`](./src/WQ__factory.js)
### Examples
- [deploy](./examples/deploy-WQ.js)
- [read operations](./examples/read-operations-WQ.js)
- [write operations](./examples/write-operations-WQ.js)
- [events](./examples/events-WQ.js)
### Tests
- [transactional test](./test/e2e/WQ.e2e.test.js)
### Functions
- `allowance(address, address) view returns (uint256)`
- `approve(address guy, uint256 wad) returns (bool)`
- `balanceOf(address) view returns (uint256)`
- `decimals() view returns (uint8)`
- `deposit() payable`
- `name() view returns (string)`
- `symbol() view returns (string)`
- `totalSupply() view returns (uint256)`
- `transfer(address dst, uint256 wad) returns (bool)`
- `transferFrom(address src, address dst, uint256 wad) returns (bool)`
- `withdraw(uint256 wad)`
### Events
- `Approval(address indexed src, address indexed guy, uint256 wad)`
- `Deposit(address indexed dst, uint256 wad)`
- `Transfer(address indexed src, address indexed dst, uint256 wad)`
- `Withdrawal(address indexed src, uint256 wad)`
### Errors
- (none)
