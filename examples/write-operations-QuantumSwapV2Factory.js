const { Initialize } = require("quantumcoin/config");
const { JsonRpcProvider } = require("quantumcoin");
const { createTestWallet } = require("./_test-wallet");
const { QuantumSwapV2Factory } = require("quantumswap");

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const wallet = createTestWallet(provider);
  const contract = QuantumSwapV2Factory.connect(address, wallet);

  console.log("Connected:", contract.target);
  console.log("Done");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
