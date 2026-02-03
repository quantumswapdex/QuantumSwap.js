const { Initialize } = require("quantumcoin/config");
const { JsonRpcProvider, Wallet, getCreateAddress } = require("quantumcoin");
const { TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE } = require("./_test-wallet");
const { IERC20__factory, IERC20 } = require("quantumswap");

async function main() {
  const rpcUrl = process.env.QC_RPC_URL;
  if (!rpcUrl) throw new Error("QC_RPC_URL is required");
  const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
  await Initialize(null);

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE);
  const from = wallet.address;

  const factory = new IERC20__factory(wallet);
  const deployTxReq = factory.getDeployTransaction();
  const nonce0 = await provider.getTransactionCount(from, "pending");
  const predicted = getCreateAddress({ from, nonce: nonce0 });

  const rawDeploy = await wallet.signTransaction({ ...deployTxReq, nonce: nonce0, chainId, gasLimit: 6_000_000, gasPrice: 1n });
  const sentDeploy = await provider.sendRawTransaction(rawDeploy);
  await sentDeploy.wait(1, 600_000);

  const contract = IERC20.connect(predicted, provider);
  console.log("deployed at:", contract.target);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
