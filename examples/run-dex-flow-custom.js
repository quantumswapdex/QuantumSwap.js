/**
 * DEX full flow (same steps as test/e2e/dex-full-flow.e2e.test.js):
 * 1–3) WQ, Factory, Router — COMMENTED OUT; uses pre-deployed addresses below.
 *       Uncomment the "Deploy WQ, Factory, Router" block to deploy these contracts instead.
 * 4) Deploy BigCat and SmallDog tokens (SimpleERC20)
 * 5) Create pair (BigCat, SmallDog); parse PairCreated
 * 6) Reserves check (pair)
 * 7) Add liquidity (1000 BigCat, 1000 SmallDog)
 * 8) Quote (getAmountsOut / getAmountsIn)
 * 9) Swap: swapExactTokensForTokens (10 BigCat → SmallDog)
 * 10) Swap ETH: WQ deposit, create WQ/BigCat pair if needed, addLiquidityETH, swapExactETHForTokens
 * 11) Send 100 BigCat and 100 SmallDog to another wallet
 * Uses same gas estimate pattern as the test (estimateGasLimit / deployGasLimit with 10% buffer).
 *
 * Usage: node examples/run-dex-flow-custom.js
 * Optional: QC_RPC_URL=https://public.rpc.quantumcoinapi.com QC_CHAIN_ID=123123 (for mainnet)
 * Requires: quantumcoin package (and SimpleERC20 artifact) and RPC node.
 */

const path = require("node:path");
const { Initialize } = require("quantumcoin/config");
const {
  JsonRpcProvider,
  Wallet,
  Contract,
  ContractFactory,
  getCreateAddress,
  getAddress,
  parseUnits,
  isAddress,
  Interface,
} = require("quantumcoin");

// Use https://public.rpc.quantumcoinapi.com for mainnet
const RPC_URL = process.env.QC_RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
const DEADLINE_OFFSET = 1200;
const DEPLOY_GAS_FALLBACK = 6_000_000n;
const TX_GAS_FALLBACK = 400_000n;
const GAS_BUFFER_PERCENT = 110n; // 10% buffer over estimate (same as test)

// Pre-deployed contract addresses for test release Dec 2025 (experimental). Replace with your own if needed.
// Uncomment the deploy block below to deploy WQ, Factory, and Router instead.
const WQ_ADDRESS = "0x0E49c26cd1ca19bF8ddA2C8985B96783288458754757F4C9E00a5439A7291628";
const FACTORY_ADDRESS = "0xbbF45a1B60044669793B444eD01Eb33e03Bb8cf3c5b6ae7887B218D05C5Cbf1d";
const ROUTER_ADDRESS = "0x41323EF72662185f44a03ea0ad8094a0C9e925aB1102679D8e957e838054aac5";

let SIMPLE_ERC20_ABI;
let SIMPLE_ERC20_BYTECODE;
try {
  let artifact;
  try {
    artifact = require("quantumcoin/examples/sdk-generator-erc20.inline.json");
  } catch {
    const qcDir = path.dirname(require.resolve("quantumcoin"));
    artifact = require(path.join(qcDir, "examples", "sdk-generator-erc20.inline.json"));
  }
  const simple = Array.isArray(artifact) ? artifact[0] : artifact;
  SIMPLE_ERC20_ABI = simple.abi;
  SIMPLE_ERC20_BYTECODE = simple.bin;
} catch (e) {
  SIMPLE_ERC20_ABI = null;
  SIMPLE_ERC20_BYTECODE = null;
}

function deadline() {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_OFFSET);
}

/** Estimate gas via provider.estimateGas, add buffer, fallback on error (same as test). */
async function estimateGasLimit(provider, txRequest, fallback) {
  try {
    const est = await provider.estimateGas(txRequest);
    const estBn = typeof est === "bigint" ? est : BigInt(est);
    const withBuffer = (estBn * GAS_BUFFER_PERCENT) / 100n;
    return withBuffer > 0n ? withBuffer : fallback;
  } catch {
    return fallback;
  }
}

/** Deploy gas: estimate from getDeployTransaction().data, apply floor for large bytecode (same as test). */
async function deployGasLimit(provider, from, getDeployTx, fallback, bytecodeFloor) {
  const txReq = getDeployTx();
  if (!txReq || !txReq.data) return fallback;
  let gas = await estimateGasLimit(provider, { from, data: txReq.data }, fallback);
  if (bytecodeFloor && txReq.data && txReq.data.length > 40000 && gas < bytecodeFloor) {
    gas = bytecodeFloor;
  }
  return gas;
}

async function main() {
  if (!SIMPLE_ERC20_ABI || !SIMPLE_ERC20_BYTECODE) {
    console.error("SimpleERC20 artifact not found (quantumcoin examples/sdk-generator-erc20.inline.json).");
    process.exit(1);
  }

  await Initialize(null);
  // quantumswap (file:..) uses repo root's quantumcoin; initialize that instance too
  try {
    const qswapMain = require.resolve("quantumswap");
    const repoRoot = path.join(path.dirname(qswapMain), "..");
    const rootQcConfig = require(path.join(repoRoot, "node_modules", "quantumcoin", "config"));
    if (rootQcConfig && typeof rootQcConfig.Initialize === "function") {
      await rootQcConfig.Initialize(null);
    }
  } catch {
    // ignore
  }
  const {
    WQ,
    WQ__factory,
    QuantumSwapV2Factory,
    QuantumSwapV2Factory__factory,
    QuantumSwapV2Router02,
    QuantumSwapV2Router02__factory,
    QuantumSwapV2Pair,
  } = require("quantumswap");
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  const TEST_WALLET_ENCRYPTED_JSON =
    "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}";
  const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";
  const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);
  const walletAddr = getAddress(wallet.address);
  console.log("RPC:", RPC_URL, "| ChainId:", CHAIN_ID, "| Owner:", walletAddr);
  console.log("");

  let wqAddressNorm = getAddress(WQ_ADDRESS);
  let factoryAddressNorm = getAddress(FACTORY_ADDRESS);
  let routerAddress = getAddress(ROUTER_ADDRESS);
  let wq;
  let factoryContract;
  let routerContract;

  // --- 1–3) WQ, Factory, Router: use pre-deployed addresses. Uncomment block below to deploy instead. ---
  /*
  // Uncomment from here to deploy WQ, Factory, and Router (steps 1–3):
  const wqFactory = new WQ__factory(wallet);
  const wqGasLimit = await deployGasLimit(provider, walletAddr, () => wqFactory.getDeployTransaction(), DEPLOY_GAS_FALLBACK, 6_000_000n);
  const wqDeploy = await wqFactory.deploy({ gasLimit: wqGasLimit });
  await wqDeploy.deployTransaction().wait(1, 600_000);
  wqAddressNorm = getAddress(wqDeploy.target);
  console.log("1) WQ deployed:", wqAddressNorm);

  const factoryFactory = new QuantumSwapV2Factory__factory(wallet);
  const factoryGasLimit = await deployGasLimit(provider, walletAddr, () => factoryFactory.getDeployTransaction(walletAddr), DEPLOY_GAS_FALLBACK, 6_000_000n);
  factoryContract = await factoryFactory.deploy(walletAddr, { gasLimit: factoryGasLimit });
  await factoryContract.deployTransaction().wait(1, 600_000);
  factoryAddressNorm = getAddress(factoryContract.target);
  console.log("2) Factory deployed:", factoryAddressNorm);

  const routerFactory = new QuantumSwapV2Router02__factory(wallet);
  const routerGasLimit = await deployGasLimit(provider, walletAddr, () => routerFactory.getDeployTransaction(factoryAddressNorm, wqAddressNorm), DEPLOY_GAS_FALLBACK, 6_000_000n);
  routerContract = await routerFactory.deploy(factoryAddressNorm, wqAddressNorm, { gasLimit: routerGasLimit });
  await routerContract.deployTransaction().wait(1, 600_000);
  routerAddress = getAddress(routerContract.target);
  console.log("3) Router deployed:", routerAddress);
  */
  // Attach to pre-deployed contracts (comment out the three lines below if you uncommented the deploy block above)
  wq = WQ.connect(wqAddressNorm, wallet);
  factoryContract = QuantumSwapV2Factory.connect(factoryAddressNorm, wallet);
  routerContract = QuantumSwapV2Router02.connect(routerAddress, wallet);
  console.log("1–3) Using pre-deployed WQ, Factory, Router");
  console.log("   WQ:", wqAddressNorm);
  console.log("   Factory:", factoryAddressNorm);
  console.log("   Router:", routerAddress);
  console.log("");

  const txHashes = [];

  // --- 4) Deploy BigCat and SmallDog tokens ---
  console.log("4) Deploying BigCat and SmallDog tokens...");
  const initialSupply = parseUnits("1000000", 18);
  const simpleErc20Factory = new ContractFactory(SIMPLE_ERC20_ABI, SIMPLE_ERC20_BYTECODE, wallet);
  const deploySimpleErc20 = async (name, symbol) => {
    const tx = simpleErc20Factory.getDeployTransaction(name, symbol, initialSupply);
    const nonce = await provider.getTransactionCount(walletAddr, "pending");
    const address = getCreateAddress({ from: walletAddr, nonce });
    const gasLimit = await estimateGasLimit(provider, { from: walletAddr, data: tx.data }, DEPLOY_GAS_FALLBACK);
    const resp = await wallet.sendTransaction({ ...tx, nonce, gasLimit });
    await resp.wait(1, 600_000);
    const contract = new Contract(address, SIMPLE_ERC20_ABI, wallet);
    contract._deployTx = resp;
    return contract;
  };
  const bigCat = await deploySimpleErc20("BigCat", "BCAT");
  const smallDog = await deploySimpleErc20("SmallDog", "SDOG");
  txHashes.push(bigCat._deployTx.hash);
  txHashes.push(smallDog._deployTx.hash);
  const bigCatAddress = getAddress(bigCat.target);
  const smallDogAddress = getAddress(smallDog.target);
  console.log("   BigCat:", bigCatAddress);
  console.log("   SmallDog:", smallDogAddress);
  console.log("");

  // --- 5) Create pair (BigCat, SmallDog) ---
  console.log("5) Creating pair (BigCat, SmallDog)...");
  const createPairTxReq = await factoryContract.populateTransaction.createPair(bigCatAddress, smallDogAddress);
  const createPairGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...createPairTxReq }, TX_GAS_FALLBACK);
  const createPairTx = await factoryContract.createPair(bigCatAddress, smallDogAddress, { gasLimit: createPairGasLimit });
  txHashes.push(createPairTx.hash);
  const createPairReceipt = await createPairTx.wait(1, 600_000);
  let pairAddressFromEvent = null;
  try {
    pairAddressFromEvent = getAddress(await factoryContract.getPair(bigCatAddress, smallDogAddress));
  } catch {
    pairAddressFromEvent = null;
  }
  const zeroAddress32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const pairCreated =
    pairAddressFromEvent &&
    isAddress(pairAddressFromEvent) &&
    pairAddressFromEvent !== zeroAddress32 &&
    pairAddressFromEvent !== "0x" + "0".repeat(64);
  if (pairCreated) {
    console.log("   Pair:", pairAddressFromEvent);
    if (Array.isArray(createPairReceipt.logs) && createPairReceipt.logs.length >= 1) {
      const factoryIface = new Interface(QuantumSwapV2Factory.abi);
      for (const log of createPairReceipt.logs) {
        if (!log.topics || !log.data) continue;
        try {
          const parsed = factoryIface.parseLog({ topics: log.topics, data: log.data });
          if (parsed && parsed.name === "PairCreated") break;
        } catch {
          // not this contract's event
        }
      }
    }
  } else {
    console.log("   Pair not created (getPair returned zero or invalid).");
  }
  console.log("");

  // --- 6) Reserves (pair) ---
  if (pairCreated) {
    const pairContract = QuantumSwapV2Pair.connect(pairAddressFromEvent, provider);
    const reservesResult = await pairContract.getReserves();
    const reserve0 = Array.isArray(reservesResult) ? reservesResult[0] : reservesResult;
    const reserve1 = Array.isArray(reservesResult) ? reservesResult[1] : 0n;
    console.log("6) Pair reserves (before liquidity): reserve0=" + reserve0.toString() + ", reserve1=" + reserve1.toString());
    console.log("");
  }

  // --- 7) Add liquidity (1000 BigCat, 1000 SmallDog) ---
  if (pairCreated) {
    console.log("7) Adding liquidity (1000 BigCat, 1000 SmallDog)...");
    const amountADesired = parseUnits("1000", 18);
    const amountBDesired = parseUnits("1000", 18);
    const approveAmount = amountADesired > amountBDesired ? amountADesired : amountBDesired;
    const approveTxReqA = await bigCat.populateTransaction.approve(routerAddress, approveAmount);
    const approveGasA = await estimateGasLimit(provider, { from: walletAddr, ...approveTxReqA }, TX_GAS_FALLBACK);
    const approveA = await bigCat.approve(routerAddress, approveAmount, { gasLimit: approveGasA });
    txHashes.push(approveA.hash);
    await approveA.wait(1, 600_000);
    const approveTxReqB = await smallDog.populateTransaction.approve(routerAddress, approveAmount);
    const approveGasB = await estimateGasLimit(provider, { from: walletAddr, ...approveTxReqB }, TX_GAS_FALLBACK);
    const approveB = await smallDog.approve(routerAddress, approveAmount, { gasLimit: approveGasB });
    txHashes.push(approveB.hash);
    await approveB.wait(1, 600_000);
    const addLiqTxReq = await routerContract.populateTransaction.addLiquidity(
      bigCatAddress,
      smallDogAddress,
      amountADesired,
      amountBDesired,
      0n,
      0n,
      walletAddr,
      deadline(),
    );
    const addLiqGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...addLiqTxReq }, TX_GAS_FALLBACK);
    const addLiqTx = await routerContract.addLiquidity(
      bigCatAddress,
      smallDogAddress,
      amountADesired,
      amountBDesired,
      0n,
      0n,
      walletAddr,
      deadline(),
      { gasLimit: addLiqGasLimit },
    );
    txHashes.push(addLiqTx.hash);
    await addLiqTx.wait(1, 600_000);
    const pairContract = QuantumSwapV2Pair.connect(pairAddressFromEvent, provider);
    const reservesAfter = await pairContract.getReserves();
    const res0 = Array.isArray(reservesAfter) ? reservesAfter[0] : reservesAfter;
    const res1 = Array.isArray(reservesAfter) ? reservesAfter[1] : 0n;
    console.log("   Reserves after addLiquidity:", res0.toString(), res1.toString());
    console.log("");
  }

  // --- 8) Quote (getAmountsOut / getAmountsIn) ---
  const pathBigCatToSmallDog = [bigCatAddress, smallDogAddress];
  const amountIn = parseUnits("1", 18);
  let amountsOut = [];
  try {
    amountsOut = await routerContract.getAmountsOut(amountIn, pathBigCatToSmallDog);
  } catch {
    // may revert with no liquidity
  }
  if (Array.isArray(amountsOut) && amountsOut.length >= 2) {
    console.log("8) Quote getAmountsOut(1 BigCat):", amountsOut[1].toString(), "SmallDog");
  }
  let amountsIn = [];
  try {
    amountsIn = await routerContract.getAmountsIn(parseUnits("1", 18), pathBigCatToSmallDog);
  } catch {
    // may revert with no liquidity
  }
  if (Array.isArray(amountsIn) && amountsIn.length >= 1) {
    console.log("   getAmountsIn(1 SmallDog):", amountsIn[0].toString(), "BigCat");
  }
  console.log("");

  // --- 9) Swap: 10 BigCat → SmallDog ---
  if (pairCreated) {
    console.log("9) Swapping 10 BigCat for SmallDog...");
    const swapAmountIn = parseUnits("10", 18);
    const pathSwap = [bigCatAddress, smallDogAddress];
    const approveSwapTxReq = await bigCat.populateTransaction.approve(routerAddress, swapAmountIn);
    const approveSwapGas = await estimateGasLimit(provider, { from: walletAddr, ...approveSwapTxReq }, TX_GAS_FALLBACK);
    const approveSwap = await bigCat.approve(routerAddress, swapAmountIn, { gasLimit: approveSwapGas });
    txHashes.push(approveSwap.hash);
    await approveSwap.wait(1, 600_000);
    const swapTxReq = await routerContract.populateTransaction.swapExactTokensForTokens(
      swapAmountIn,
      0n,
      pathSwap,
      walletAddr,
      deadline(),
    );
    const swapGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...swapTxReq }, TX_GAS_FALLBACK);
    const swapTx = await routerContract.swapExactTokensForTokens(
      swapAmountIn,
      0n,
      pathSwap,
      walletAddr,
      deadline(),
      { gasLimit: swapGasLimit },
    );
    txHashes.push(swapTx.hash);
    await swapTx.wait(1, 600_000);
    const smallDogBalanceRaw = await smallDog.balanceOf(walletAddr);
    const smallDogBalance = typeof smallDogBalanceRaw === "bigint" ? smallDogBalanceRaw : BigInt(String(smallDogBalanceRaw));
    console.log("   SmallDog balance after swap:", smallDogBalance.toString());
    console.log("");
  }

  // --- 10) Swap ETH: WQ deposit, WQ/BigCat pair, addLiquidityETH, swapExactETHForTokens ---
  if (pairCreated) {
    console.log("10) Swap ETH: wrap, add WQ/BigCat liquidity, swapExactETHForTokens...");
    const ethToWrap = parseUnits("1", 18);
    const depositTxReq = await wq.populateTransaction.deposit({ value: ethToWrap });
    const depositGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...depositTxReq }, TX_GAS_FALLBACK);
    const depositTx = await wq.deposit({ value: ethToWrap, gasLimit: depositGasLimit });
    txHashes.push(depositTx.hash);
    await depositTx.wait(1, 600_000);

    let pairWqBigCatAddr = null;
    try {
      const raw = await factoryContract.getPair(wqAddressNorm, bigCatAddress);
      pairWqBigCatAddr = getAddress(raw);
    } catch {
      pairWqBigCatAddr = null;
    }
    const zeroAddr = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const hasWqPair =
      pairWqBigCatAddr && isAddress(pairWqBigCatAddr) && pairWqBigCatAddr !== zeroAddr && pairWqBigCatAddr !== "0x" + "0".repeat(64);
    if (!hasWqPair) {
      const createWqPairTxReq = await factoryContract.populateTransaction.createPair(wqAddressNorm, bigCatAddress);
      const createWqPairGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...createWqPairTxReq }, TX_GAS_FALLBACK);
      const createWqPairTx = await factoryContract.createPair(wqAddressNorm, bigCatAddress, { gasLimit: createWqPairGasLimit });
      txHashes.push(createWqPairTx.hash);
      await createWqPairTx.wait(1, 600_000);
      pairWqBigCatAddr = getAddress(await factoryContract.getPair(wqAddressNorm, bigCatAddress));
    }

    const tokenForEthLiq = parseUnits("500", 18);
    const approveBigCatTxReq = await bigCat.populateTransaction.approve(routerAddress, tokenForEthLiq);
    const approveBigCatGas = await estimateGasLimit(provider, { from: walletAddr, ...approveBigCatTxReq }, TX_GAS_FALLBACK);
    const approveBigCat = await bigCat.approve(routerAddress, tokenForEthLiq, { gasLimit: approveBigCatGas });
    txHashes.push(approveBigCat.hash);
    await approveBigCat.wait(1, 600_000);
    const addLiqEthTxReq = await routerContract.populateTransaction.addLiquidityETH(
      bigCatAddress,
      tokenForEthLiq,
      0n,
      0n,
      walletAddr,
      deadline(),
      { value: ethToWrap },
    );
    const addLiqEthGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...addLiqEthTxReq }, TX_GAS_FALLBACK);
    const addLiqEthTx = await routerContract.addLiquidityETH(
      bigCatAddress,
      tokenForEthLiq,
      0n,
      0n,
      walletAddr,
      deadline(),
      { value: ethToWrap, gasLimit: addLiqEthGasLimit },
    );
    txHashes.push(addLiqEthTx.hash);
    await addLiqEthTx.wait(1, 600_000);

    const ethSwapValue = parseUnits("0.1", 18);
    const pathEthToToken = [wqAddressNorm, bigCatAddress];
    const swapEthTxReq = await routerContract.populateTransaction.swapExactETHForTokens(
      0n,
      pathEthToToken,
      walletAddr,
      deadline(),
      { value: ethSwapValue },
    );
    const swapEthGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...swapEthTxReq }, TX_GAS_FALLBACK);
    const swapEthTx = await routerContract.swapExactETHForTokens(
      0n,
      pathEthToToken,
      walletAddr,
      deadline(),
      { value: ethSwapValue, gasLimit: swapEthGasLimit },
    );
    txHashes.push(swapEthTx.hash);
    await swapEthTx.wait(1, 600_000);
    const bigCatBalanceRaw = await bigCat.balanceOf(walletAddr);
    console.log("   BigCat balance after ETH swap:", (typeof bigCatBalanceRaw === "bigint" ? bigCatBalanceRaw : BigInt(String(bigCatBalanceRaw))).toString());
    console.log("");
  }

  // --- 11) Send 100 BigCat and 100 SmallDog to another wallet ---
  console.log("11) Sending 100 BigCat and 100 SmallDog to another wallet...");
  const otherWallet = Wallet.createRandom().connect(provider);
  const otherAddr = getAddress(otherWallet.address);
  const transferAmount = parseUnits("100", 18);
  const transferATxReq = await bigCat.populateTransaction.transfer(otherAddr, transferAmount);
  const transferAGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...transferATxReq }, TX_GAS_FALLBACK);
  const transferATx = await bigCat.transfer(otherAddr, transferAmount, { gasLimit: transferAGasLimit });
  txHashes.push(transferATx.hash);
  await transferATx.wait(1, 600_000);
  const transferBTxReq = await smallDog.populateTransaction.transfer(otherAddr, transferAmount);
  const transferBGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...transferBTxReq }, TX_GAS_FALLBACK);
  const transferBTx = await smallDog.transfer(otherAddr, transferAmount, { gasLimit: transferBGasLimit });
  txHashes.push(transferBTx.hash);
  await transferBTx.wait(1, 600_000);
  const otherBigCatRaw = await bigCat.balanceOf(otherAddr);
  const otherSmallDogRaw = await smallDog.balanceOf(otherAddr);
  console.log("   Other wallet BigCat balance:", (typeof otherBigCatRaw === "bigint" ? otherBigCatRaw : BigInt(String(otherBigCatRaw))).toString());
  console.log("   Other wallet SmallDog balance:", (typeof otherSmallDogRaw === "bigint" ? otherSmallDogRaw : BigInt(String(otherSmallDogRaw))).toString());
  console.log("");

  // --- Summary: contract addresses ---
  console.log("========== CONTRACT ADDRESSES ==========");
  console.log("  wallet:", walletAddr);
  console.log("  WQ:", wqAddressNorm);
  console.log("  Factory:", factoryAddressNorm);
  console.log("  Router:", routerAddress);
  console.log("  BigCat:", bigCatAddress);
  console.log("  SmallDog:", smallDogAddress);
  console.log("  PairBigCatSmallDog:", pairCreated ? pairAddressFromEvent : "(not created)");
  if (pairCreated) {
    try {
      const pairWq = await factoryContract.getPair(wqAddressNorm, bigCatAddress);
      const pairWqAddr = getAddress(pairWq);
      if (pairWqAddr && pairWqAddr !== zeroAddress32) console.log("  PairWqBigCat:", pairWqAddr);
    } catch {
      // ignore
    }
  }
  console.log("  OtherWallet:", otherAddr);
  console.log("========================================");
  console.log("");
  console.log("========== TRANSACTION HASHES ==========");
  txHashes.forEach((hash, i) => {
    console.log("  [" + (i + 1) + "] " + hash);
  });
  console.log("========================================");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
