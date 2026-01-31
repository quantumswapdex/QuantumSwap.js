/**
 * Walkthrough: full DEX flow using Test Release (Dec 2025) contracts (TypeScript).
 *
 * Same flow as walkthrough-dex-full-flow.js: connect to pre-deployed WQ, Factory, Router;
 * deploy two ERC20 tokens (SimpleERC20), create pair, add liquidity, swap token-for-token,
 * then swap ETH for token.
 *
 * Usage:
 *   QC_RPC_URL=http://your-rpc:8545 npx ts-node examples/walkthrough-dex-full-flow.ts
 *
 * Optional: QC_CHAIN_ID (default 123123), QC_WALLET_JSON + QC_WALLET_PASSPHRASE (else uses _test-wallet).
 *
 * Requires: quantumcoin package with examples/sdk-generator-erc20.inline.json (SimpleERC20 artifact).
 */

import * as path from "node:path";

import { Initialize } from "quantumcoin/config";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  ContractFactory,
  getCreateAddress,
  getAddress,
  parseUnits,
  isAddress,
} from "quantumcoin";

import {
  WQ,
  QuantumSwapV2Factory,
  QuantumSwapV2Router02,
  QuantumSwapV2Pair,
} from "..";

// Test Release (Dec 2025) — do not deploy these
const WQ_CONTRACT_ADDRESS = "0x0E49c26cd1ca19bF8ddA2C8985B96783288458754757F4C9E00a5439A7291628";
const V2_CORE_FACTORY_CONTRACT_ADDRESS = "0xbbF45a1B60044669793B444eD01Eb33e03Bb8cf3c5b6ae7887B218D05C5Cbf1d";
const SWAP_ROUTER_V2_CONTRACT_ADDRESS = "0x41323EF72662185f44a03ea0ad8094a0C9e925aB1102679D8e957e838054aac5";

const DEPLOY_GAS_LIMIT = 6_000_000;
const TX_GAS_LIMIT = 400_000;
const DEADLINE_OFFSET = 1200;

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_OFFSET);
}

interface SimpleErc20Artifact {
  abi: unknown[];
  bin: string;
}

let SIMPLE_ERC20_ABI: unknown[] | null = null;
let SIMPLE_ERC20_BYTECODE: string | null = null;
try {
  const qcPkg = require.resolve("quantumcoin/package.json");
  const qcRoot = path.dirname(qcPkg);
  const artifact = require(path.join(qcRoot, "examples", "sdk-generator-erc20.inline.json")) as SimpleErc20Artifact[] | SimpleErc20Artifact;
  const simple = Array.isArray(artifact) ? artifact[0] : artifact;
  SIMPLE_ERC20_ABI = simple.abi as unknown[];
  SIMPLE_ERC20_BYTECODE = simple.bin;
} catch {
  SIMPLE_ERC20_ABI = null;
  SIMPLE_ERC20_BYTECODE = null;
}

async function main(): Promise<void> {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) {
    console.error("QC_RPC_URL is required. Example: QC_RPC_URL=http://localhost:8545 npx ts-node examples/walkthrough-dex-full-flow.ts");
    process.exit(1);
  }
  if (!SIMPLE_ERC20_ABI || !SIMPLE_ERC20_BYTECODE) {
    console.error("SimpleERC20 artifact not found (quantumcoin examples/sdk-generator-erc20.inline.json). Cannot deploy tokens.");
    process.exit(1);
  }

  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  await Initialize(null);

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  let wallet: InstanceType<typeof Wallet>;
  if (process.env.QC_WALLET_JSON && process.env.QC_WALLET_PASSPHRASE) {
    wallet = Wallet.fromEncryptedJsonSync(process.env.QC_WALLET_JSON, process.env.QC_WALLET_PASSPHRASE, provider);
  } else {
    const { createTestWallet } = require("./_test-wallet") as { createTestWallet: (provider: InstanceType<typeof JsonRpcProvider>) => InstanceType<typeof Wallet> };
    wallet = createTestWallet(provider);
    console.log("Using demo test wallet (set QC_WALLET_JSON + QC_WALLET_PASSPHRASE for your own).");
  }
  const walletAddr = getAddress(wallet.address);

  // Step 1: Connect to pre-deployed WQ, Factory, Router
  console.log("Step 1: Connecting to Test Release contracts...");
  const wq = WQ.connect(WQ_CONTRACT_ADDRESS, wallet);
  const wqAddressNorm = getAddress(WQ_CONTRACT_ADDRESS);
  const factoryContract = QuantumSwapV2Factory.connect(V2_CORE_FACTORY_CONTRACT_ADDRESS, wallet);
  const routerContract = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, wallet);
  const routerAddress = routerContract.target;
  console.log("  WQ:", wqAddressNorm);
  console.log("  Factory:", getAddress(V2_CORE_FACTORY_CONTRACT_ADDRESS));
  console.log("  Router:", getAddress(routerAddress));

  // Step 2: Deploy two ERC20 tokens (SimpleERC20 with initial supply)
  console.log("Step 2: Deploying TokenA and TokenB (SimpleERC20)...");
  const initialSupply = parseUnits("1000000", 18);
  const simpleErc20Factory = new ContractFactory(SIMPLE_ERC20_ABI, SIMPLE_ERC20_BYTECODE, wallet);
  const deploySimpleErc20 = async (name: string, symbol: string): Promise<InstanceType<typeof Contract> & { _deployTx?: unknown }> => {
    const tx = simpleErc20Factory.getDeployTransaction(name, symbol, initialSupply);
    const nonce = await provider.getTransactionCount(walletAddr, "pending");
    const address = getCreateAddress({ from: walletAddr, nonce });
    const resp = await wallet.sendTransaction({ ...tx, nonce, gasLimit: DEPLOY_GAS_LIMIT });
    await resp.wait(1, 600_000);
    const contract = new Contract(address, SIMPLE_ERC20_ABI, wallet) as InstanceType<typeof Contract> & { _deployTx?: unknown };
    contract._deployTx = resp;
    return contract;
  };
  const tokenA = await deploySimpleErc20("TokenA", "TKA");
  const tokenB = await deploySimpleErc20("TokenB", "TKB");
  const tokenAAddress = getAddress(tokenA.target);
  const tokenBAddress = getAddress(tokenB.target);
  console.log("  TokenA:", tokenAAddress);
  console.log("  TokenB:", tokenBAddress);

  // Step 3: Create pair
  console.log("Step 3: Creating pair (TokenA, TokenB)...");
  const createPairTx = await factoryContract.createPair(tokenAAddress, tokenBAddress, { gasLimit: TX_GAS_LIMIT });
  await createPairTx.wait(1, 600_000);
  const pairAddressFromEvent = getAddress(await factoryContract.getPair(tokenAAddress, tokenBAddress));
  const zeroAddress32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const pairCreated = pairAddressFromEvent && isAddress(pairAddressFromEvent) && pairAddressFromEvent !== zeroAddress32 && pairAddressFromEvent !== "0x" + "0".repeat(64);
  if (!pairCreated) {
    console.error("  Pair not created (getPair returned zero or invalid address).");
    process.exit(1);
  }
  console.log("  Pair:", pairAddressFromEvent);

  // Step 4: Add liquidity
  console.log("Step 4: Adding liquidity...");
  const amountADesired = parseUnits("1000", 18);
  const amountBDesired = parseUnits("1000", 18);
  const approveAmount = amountADesired > amountBDesired ? amountADesired : amountBDesired;
  await (await tokenA.approve(routerAddress, approveAmount, { gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);
  await (await tokenB.approve(routerAddress, approveAmount, { gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);
  const addLiqTx = await routerContract.addLiquidity(
    tokenAAddress,
    tokenBAddress,
    amountADesired,
    amountBDesired,
    0n,
    0n,
    walletAddr,
    deadline(),
    { gasLimit: TX_GAS_LIMIT },
  );
  await addLiqTx.wait(1, 600_000);
  const pairContract = QuantumSwapV2Pair.connect(pairAddressFromEvent, provider);
  const reservesAfter = await pairContract.getReserves();
  const res0 = Array.isArray(reservesAfter) ? reservesAfter[0] : reservesAfter;
  const res1 = Array.isArray(reservesAfter) ? reservesAfter[1] : 0n;
  console.log("  Reserves after addLiquidity:", res0.toString(), res1.toString());

  // Step 5: Swap token for token
  console.log("Step 5: Swapping TokenA -> TokenB (swapExactTokensForTokens)...");
  const swapAmountIn = parseUnits("10", 18);
  const pathSwap = [tokenAAddress, tokenBAddress];
  await (await tokenA.approve(routerAddress, swapAmountIn, { gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);
  const swapTx = await routerContract.swapExactTokensForTokens(
    swapAmountIn,
    0n,
    pathSwap,
    walletAddr,
    deadline(),
    { gasLimit: TX_GAS_LIMIT },
  );
  await swapTx.wait(1, 600_000);
  const tokenBBalanceAfterSwapRaw = await tokenB.balanceOf(walletAddr);
  const tokenBBalanceAfterSwap = typeof tokenBBalanceAfterSwapRaw === "bigint" ? tokenBBalanceAfterSwapRaw : BigInt(String(tokenBBalanceAfterSwapRaw));
  console.log("  TokenB balance after swap:", tokenBBalanceAfterSwap.toString());

  // Step 6: Swap ETH for token (wrap, add WQ-token liquidity if needed, swapExactETHForTokens)
  console.log("Step 6: Swapping ETH for TokenA (wrap, addLiquidityETH, swapExactETHForTokens)...");
  const ethToWrap = parseUnits("1", 18);
  await (await wq.deposit({ value: ethToWrap, gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);

  const pairWqTokenA = await factoryContract.getPair(wqAddressNorm, tokenAAddress);
  let pairWqTokenAAddr: string | null = null;
  try {
    pairWqTokenAAddr = getAddress(pairWqTokenA);
  } catch {
    pairWqTokenAAddr = null;
  }
  const zeroAddr = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasWqPair = pairWqTokenAAddr && isAddress(pairWqTokenAAddr) && pairWqTokenAAddr !== zeroAddr && pairWqTokenAAddr !== "0x" + "0".repeat(64);
  if (!hasWqPair) {
    await (await factoryContract.createPair(wqAddressNorm, tokenAAddress, { gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);
  }
  const tokenForEthLiq = parseUnits("500", 18);
  await (await tokenA.approve(routerAddress, tokenForEthLiq, { gasLimit: TX_GAS_LIMIT })).wait(1, 600_000);
  await (
    await routerContract.addLiquidityETH(
      tokenAAddress,
      tokenForEthLiq,
      0n,
      0n,
      walletAddr,
      deadline(),
      { value: ethToWrap, gasLimit: TX_GAS_LIMIT },
    )
  ).wait(1, 600_000);

  const ethSwapValue = parseUnits("0.1", 18);
  const pathEthToToken = [wqAddressNorm, tokenAAddress];
  const swapEthTx = await routerContract.swapExactETHForTokens(
    0n,
    pathEthToToken,
    walletAddr,
    deadline(),
    { value: ethSwapValue, gasLimit: TX_GAS_LIMIT },
  );
  await swapEthTx.wait(1, 600_000);
  console.log("  swapExactETHForTokens completed.");

  console.log("Walkthrough complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
