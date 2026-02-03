const path = require("node:path");
const parentQcPath = path.join(__dirname, "..", "node_modules", "quantumcoin");
const { Initialize } = require(path.join(parentQcPath, "config"));
const { JsonRpcProvider } = require(parentQcPath);
const parentQswapPath = path.join(__dirname, "..");
const { IERC20 } = require(parentQswapPath);

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS is required");
  await Initialize(null);

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const contract = IERC20.connect(address, provider);

  console.log("IERC20:", contract.target);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
