/**
 * @testCategory e2e
 * @blockchainRequired write
 * @description QuantumSwap V2 DEX full flow: deploy WQ/Factory/Router, two ERC20s,
 *   create pair, add liquidity (when tokens have supply), quote, token↔token and ETH↔token swaps,
 *   send tokens to another wallet, balance checks. Uses quantumcoin.js SDK: isAddress, getAddress, parseUnits, formatUnits,
 *   Interface.parseLog for event decoding.
 *
 * WARNING: Uses a hardcoded test wallet; broadcasts real transactions.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { Initialize } = require("quantumcoin/config");
const {
  JsonRpcProvider,
  Wallet,
  Contract,
  ContractFactory,
  getCreateAddress,
  isAddress,
  getAddress,
  parseUnits,
  formatUnits,
  Interface,
} = require("quantumcoin");

const {
  WQ,
  WQ__factory,
  QuantumSwapV2Factory,
  QuantumSwapV2Factory__factory,
  QuantumSwapV2Router02,
  QuantumSwapV2Router02__factory,
  QuantumSwapV2Pair,
  IERC20,
} = require("../..");

// SimpleERC20 ABI + bytecode (mint to deployer) — from quantumcoin.js examples
let SIMPLE_ERC20_ABI;
let SIMPLE_ERC20_BYTECODE;
try {
  const qcPkg = require.resolve("quantumcoin/package.json");
  const qcRoot = path.dirname(qcPkg);
  const artifact = require(path.join(qcRoot, "examples", "sdk-generator-erc20.inline.json"));
  const simple = Array.isArray(artifact) ? artifact[0] : artifact;
  SIMPLE_ERC20_ABI = simple.abi;
  SIMPLE_ERC20_BYTECODE = simple.bin;
} catch (e) {
  SIMPLE_ERC20_ABI = null;
  SIMPLE_ERC20_BYTECODE = null;
}

const TEST_WALLET_ENCRYPTED_JSON =
  "{\"address\":\"1a846abe71c8b989e8337c55d608be81c28ab3b2e40c83eaa2a68d516049aec6\",\"crypto\":{\"cipher\":\"aes-256-ctr\",\"ciphertext\":\"ab7e620dd66cb55ac201b9c6796de92bbb06f3681b5932eabe099871f1f7d79acabe30921a39ad13bfe74f42c515734882b6723760142aa3e26e011df514a534ae47bd15d86badd9c6f17c48d4c892711d54d441ee3a0ee0e5b060f816e79c7badd13ff4c235934b1986774223ecf6e8761388969bb239c759b54c8c70e6a2e27c93a4b70129c8159f461d271ae8f3573414c78b88e4d0abfa6365ed45456636d4ed971c7a0c6b84e6f0c2621e819268b135e2bcc169a54d1847b39e6ba2ae8ec969b69f330b7db9e785ed02204d5a1185915ae5338b0f40ef2a7f4d5aaf7563d502135e57f4eb89d5ec1efa5c77e374969d6cd85be625a2ed1225d68ecdd84067bfc69adb83ecd5c6050472eca28a5a646fcdd28077165c629975bec8a79fe1457cb53389b788b25e1f8eff8b2ca326d7dfcaba3f8839225a08057c018a458891fd2caa0d2b27632cffd80f592147ccec9a10dc8a08a48fb55047bff5cf85cda39eb089096bef63842fc3686412f298a54a9e4b0bf4ad36907ba373cbd6d32e7ac494af371da5aa9d38a3463220865114c4adc5e4ac258ba9c6af9fa2ddfd1aec2e16887e4b3977c69561df8599ac9d411c9dd2a4d57f92ea4e5c02aae3f49fb3bc83e16673e6c2dbe96bb181c8dfd0f9757ade2e4ff27215a836058c5ffeab042f6f97c7c02339f76a6284680e01b4bb733690eb3347fbfcc26614b8bf755f9dfce3fea9d4e4d15b164983201732c2e87593a86bca6da6972e128490338f76ae68135888070f4e59e90db54d23834769bdbda9769213faf5357f9167a224523975a946367b68f0cec98658575609f58bfd329e420a921c06713326e4cb20a0df1d77f37e78a320a637a96c604ca3fa89e24beb42313751b8f09b14f9c14c77e4fd13fc6382505d27c771bca0d821ec7c3765acffa99d83c50140a56b0b28101c762bd682fe55cb6f23cbeb3f421d7b36021010e45ac27160dd7ead99c864a1b550c7edb1246950fe32dcc049799f9085287f0a747a6ef7a023df46a23a22f3e833bbf8d404f84344870492658256ee1dfc40fda33bb8d48fc72d4520ba9fc820c9123104a045206809037709f2a5f6723fa77d6bac5a573823d4ec3a7f1cb786a52ee2697e622e5d75962fa554d1024a6c355e21f33a63b2b72e6c4742a8b1c373aa532b40518c38c90b5373c2eb8c9d7be2a9e16047a3ee09dc9a6849deac5183ace6cfe91a9bef2ffc0a7df6ccebfd4c858c84b0e0355650d7466971e66f1e3883013e5ad1be33199b1d110b79070ac1b745ccb14cf63a08f8cca3a21c9525e626ff5f0c34746e10750fb742ad51f11f2acae3676c2111853d7250d01b77821a6ba9e04400ba2c543ca9f2d701ae6f47bfad14ffe3039ee9e71f7b2401359ade9938750ddb9c5a8b018a7929ed8d0e717ff1861446ce17535e9b17c187711190aae3388bd9490837a636c25ed4d42d7079ad1a51e13292c683d5d012abcf46965c534b83ab53f2c1f0cf5830ef7582e06863a33c19a70511df632885d63245965047ea96b56f1af5b3b94a54999f784fb9574fdfcd7c1230e07a2aaa04acd3097b2b9f8ddba05ae9734491deb5c1a513c76ed276cb78bbf4839dae3156d76af444a5805129d5df791167a9c8576a1d7f760b2d2797c4658669608706fbd0ace1be2346f74862dfc9ef518e55632e43c043186e5d070deb34d12fb9e5aba84e5cb50213dc88efd39cc35bf42455aa82d5e3b707b3140be3b8623b34fdd81d08615c188ae8438a13881fdf6bf32f2cb9ff5fa625561040c6b71d4b8eccc90bc3b99650d28dd1ee63773e49664e3d48c484996b290943635a6f2eb1ce9796d3fa144a3f00ef82faaa32d6a413668f7b521517cb68b2b017fcf56c79326fa5e4060e643631ca3f0a0dc0ed718798b6f46b130d437c33f64039e887324b6f5e604b1669d613923794edbf04b1b3caea54793b52b44b170173a4f25c7ecef3b71e2aad76e556b1cb9f1d637ec52ececfa950dd31dbb6a60828a3ad34c1beffe09eb4785786d63bad10a0b0f66ea88c57380f38ea85f018dbd7f538cf1ee7624095b9a01ec5edd528f281168af020609e651ff316aa1320a710134ddfca600cc72174dcdb846d2aa29916488aa1b537b66da92e61af526debef4eb38c984569eaf549ff2129449269b492d030cd74d885f6f5785881cc4804b4a8a09ba4ff7aefe9074ac7d0c4f05d51fe4cc0ff7388a772092b9d02d70e5433a5cf3e02f46a6bd6b818d59a07ce3b9fbbf8b5faba74563bcc5240930c2d406c9aaee3e3ce0429bf68ac2b0a57adb09414cff50817d2a48fb9fa624ab863cb0c31a8b8dc5eaf6fa68cc1d7c6c685c5a33edd5c8933b9e8ab628ee428d0743699b2ff17f25586c7ce959280bb0b8c5342251f0a30b53dbc7bf1ee426ac9619c3560f811f2268ee37f189794e2e4b3db3a2fb2e34b649e504fb467438abfd1082619cc4a0b30d66beb831077812e418d2e2148db10cf4d4a29101ca52ec445b8d83519dd7de85a98e0beae9ee537096d3f1a55a7a80cdfa93d25f07c9f98e8af18cde19ec1f99c5dd4588b717a5039ddb7f177717caf0d0fd45420a70dbd6d3146890d9e450d5224146db4c33b779e3c3a04b976c052bad042ac57dd38be45407808c0fb0d7e2a8819e6cd53c6739e6612996ddaa6f066552590aa0343bc1e62b298ff2514a0cef8be21956c2e942816f7a3a3a0935eaf9b37251409ce444c986c3817e82835555fe18239f3ae33469d7965c2bde9991fde556bd07af01df52bbde0c35bb4ef48e3b5d0db53f8ca4ed35b83f760f0a1bc4ed9f86e85d6039a17df373c85402ef956f01db00eb39c4b74bd0660d29ee746714d9780d738e05c6cca414ce3d7b40dda8036a9eea9ab1388805f913eb19bdd3f09d9e161eaa50231bd9caba61971f194332dd28c696a60458c1c6c2cc5da8b1192611c7c553e9e12fe48ce46bbb891be8bb118721c86222e671ddd1da8f0ccb2b68e02f2014b4925e904e88369aaf7466bd7033a60c265d45955944916ecbdb84bf1b522b01b0149c632e04c568a7eb627c5bb90ece052ebcf79166c28b30d23fe52da0a5ab5dea83ca479a3e3b7a9cfbbfea04dbe6137c19d067317c2ec427a8c75a6b06bec6dcd5d5c0edc9aa80b9003b8e17c088b2f3db327d3e42630d82d20120240c3ba56232280787da4aabbf5bc95a864029f00710e195f2a76460a0317d10b552fe1bea097e41d49756c680a41d6ac186e62169b6b6cd7776ea84618b5b752328a5bacaa10aa122ff9b2698b43efe73d852a899db644863c8c9bc8068ea86ea843fd6fe36272b91cdc5d5317083ef3fd1e5462a0b0d0604dc57b3bbfceb0fca4cd349625dd7b25166af30efe5ee6a0af953a74d65f4736c59918ee55a3b0d9d9d42e04c7f8a77e479109f740e20c464d5d7e3d16805f47b61f403ff7f408c9e850d9baacd8067e544536a4953480b0f9ee9cd45f41ebd67b51f78788a6470cb1e5ca72ca346ce8a50d0ca0c921d5576a4455a1afb6d0bc688004712ee122cacdb29c51e84893324c27fa4a3f1917edf5352272b4c97579a6152e4b77663d0ab532915f2eeb6a862de8b696452321b660c3f2449673d086e95a7af28845a5259b763e0fcd09f72acf7b6c811066263060e5aa5b24658e880a01fd56bda4dad5ab604e129290f7d5489728f2a40968c6168b21cebbbcd11727cc9e9160c4e92e04387d3b0d62aab06a61f26daedd9fed11816ef2180172a47f47184ac4032b88758c98a2e0fb200f70e93ba695f5ebb7a1029610ad360d3b7fa1b4640b9dc674d3625eef786da93dff19bc7991b5d6193a3896664763fde479b5dfc04812111a80782854f2cf68ca7d82765cc9eb40fba4b44640710ed6e653abf9f07b466333f4fd22784d53cf40e17120f42caa841eaa24056b237827b0f47f7257c103c35027e9f503e5acfd023e7357b600d3084d361d5ee65ba319b45c153212a54e6fed85af7e43e0a926ebcbc2edf8de7e2ec9528f00bec262ad04d5c9dafccaea06a24748d28bf1799bae0e895543084539c50b5aaa4fb50d7431d6f0c8cee2a54aaf7ee7919b55bf40adb688632e5dbe273cea09e97b19c3d8e1f4de000deb66fa1942ad03a62d3252f51992244366c156000b49c297167a6cbdedea7ebae139d295f0ad298e0864249b905b7eb812886ec70ecdb286702274b5b8574149bf3866f9e46b997ff5ed622b169a0eb071347f18d530db1663906a28f4544ee4e004ab87b65476af30ede118052ff052b8dc986ca2c93dd5d4943266a579c7698ea014f688b3e8063a107feb162d392e2177b01bff77fb5abe5feebd0607158049a5a093325b7c9ee6b4dfa7a9f65c7c2fb628920d3603a1c2dad979eaa047cd661a268af1078c9788d720e64e4ce9d12e68de1e417ef2f293323681e1071f9220e1ee43d2e29d111b870ce3439f5100ecd4551ab65ee74aa1667e564957e9bc0ae1ea193980da2a0ec2698073388c85bec25ef447f0d5e93a5203fa44dff268e5cb799ed3b66e63d5e07b487e7534f24934c73a62a243e0151843a0fd3807711a101eaa7fc71f0ba68aebb9534d57cba41b094eebfb4c31cca8eddfa426f676aa347be8a7023a4e91ddb154b35cd4d5f7dbc2e5db491de99f33fc2cff2d57029ac950e1ccd681980af6a4e8969dfe39b3c7bfcbcf8fac92f1e6ec9fe572bfa6a7d65860eab2ed10ac01a71290b52e3148e84b7376a8605cd2bb0e8681ffc54691ce087685e33921bd44d36c78291713dce17569570f62137e6904f0d68cf53aa2ec395c389a75141f08114fb293ea63950e4ffee55ec6fc83cf44876b8e7f25cdd393ff87b9eda6eb746085b61a6900de191f0ce2cb388d61ece52e78bc47368194e8e00277e0d1631e6b9d4626ef76f8522582ccd5a40be3febc699bb510acc6271d55ff0f4cf3bb7669855a72efd9ca3e1056a2fe592a5bc877cce2b1f63b58383971da87873d2d1349cf5881242cdce4e7e2c5c514755746a0e0a7c2a6d9701cde005ae3420beb17c379a3516662253554f51f0423bb1844b0b90c54ed8177ceb0e1036a6609d836e748ca06c40ca64befadc6443ec286a0ce464678e8d11eb455f7bb305acebf6cb1f50e394a9bfeb752df1687831bac9cdd811f4f112ef6658d0f8799a866374ff96c5e2b79f30e7a74f8a2bc9ed1f88f01f30e30cb78ffb2bff10108f35e910ee3be4463e9e6f0ed910e8d598326e71dfa2277ffe5579d7fe9b6018bfe295b25219eae07b3b0270665c3fa00c3e0d180812b5cd62925585de84a7c48a9a86dba96544a251654d1966e082432dc85b6149cf21e91a46020ec32b66d28ba3b6a90c0617bc6fdd55aea819af2bcf84864ad60c28fe3c9f8339d0aee68b39d97f63b6e082835d86119cf9b9fdc8b827c847ce40aa10e1577a710132316845e825345e95bdf94d0c66ec65a6c4319fce4792313663b5f7a651a6710783e6ab71608ac6cbbf3af6911adf596ccf7c172b9bd5bceb6db379967b32b143bdd11d2ee12ddf64ecef6391e0f8570e6cddd3db95204919362b89b739fa94e7c1bfde799fd5e22aa25ca6ca42e30c08e23aae2385d99ebab441072a880dcefdab74a4c9bd39d363f6d1933d59400fca161d432aa00f23b1b1c19a154be8989699d549b66d44e39896f5523443bc6ddf4a65e91f1f3fb7b52318869a05856a4fc92f3694c81ed833c972fb918f7e5\",\"cipherparams\":{\"iv\":\"8c46d6162cd4c765759aedcbce2a5874\"},\"kdf\":\"scrypt\",\"kdfparams\":{\"dklen\":32,\"n\":262144,\"p\":1,\"r\":8,\"salt\":\"82fb6cdc6917609135277badacf15baa31899d08b71a5a0fa33167167c161537\"},\"mac\":\"9187b17f7eca48e6b8c586b0cd790dbe0feb876ac8385f93faa7d5e22a3c8fc7\"},\"id\":\"92caf6ee-2d43-48c0-859e-ffa1e0e23312\",\"version\":3}";
const TEST_WALLET_PASSPHRASE = "QuantumCoinExample123!";

const DEPLOY_GAS_FALLBACK = 6_000_000n;
const TX_GAS_FALLBACK = 400_000n;
const GAS_BUFFER_PERCENT = 110n; // 10% buffer over estimate
const DEADLINE_OFFSET = 1200;

function deadline() {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_OFFSET);
}

/** Estimate gas via provider.estimateGas (quantumcoin.js SDK), add buffer, fallback on error. */
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

/** Deploy gas: estimate from getDeployTransaction().data, apply floor for large bytecode. */
async function deployGasLimit(provider, from, getDeployTx, fallback, bytecodeFloor) {
  const txReq = getDeployTx();
  if (!txReq || !txReq.data) return fallback;
  let gas = await estimateGasLimit(
    provider,
    { from, data: txReq.data },
    fallback,
  );
  if (bytecodeFloor && txReq.data && txReq.data.length > 40000 && gas < bytecodeFloor) {
    gas = bytecodeFloor;
  }
  return gas;
}

describe("QuantumSwap V2 DEX full flow", () => {
  it("deploys WQ, Factory, Router; validates addresses; deploys two ERC20s; creates pair; parses PairCreated; balance checks; sends tokens to another wallet", async (t) => {
    const rpcUrl = process.env.QC_RPC_URL;
    if (!rpcUrl) {
      t.skip("QC_RPC_URL not provided");
      return;
    }
    if (!SIMPLE_ERC20_ABI || !SIMPLE_ERC20_BYTECODE) {
      t.skip("SimpleERC20 artifact not found (quantumcoin examples/sdk-generator-erc20.inline.json)");
      return;
    }

    const chainId = process.env.QC_CHAIN_ID ? Number(process.env.QC_CHAIN_ID) : 123123;
    await Initialize(null);

    const provider = new JsonRpcProvider(rpcUrl, chainId);
    const wallet = Wallet.fromEncryptedJsonSync(TEST_WALLET_ENCRYPTED_JSON, TEST_WALLET_PASSPHRASE, provider);

    // --- Address validation (quantumcoin.js isAddress / getAddress) ---
    assert.equal(isAddress(wallet.address), true, "wallet.address must be valid");
    const walletAddr = getAddress(wallet.address);
    assert.ok(walletAddr && walletAddr.length === 66 && walletAddr.startsWith("0x"));

    // Before-balance for step 11 (native): capture before any transactions
    const nativeBalanceBeforeAllTxs = await provider.getBalance(walletAddr);

    const contractAddresses = {};
    const txHashes = [];
    let totalGasUsed = 0n;
    let pairWqTokenAAddress = null;

    /** Add gasUsed from a transaction receipt to totalGasUsed. */
    function addReceiptGas(receipt) {
      if (!receipt) return;
      const g = receipt.gasUsed;
      totalGasUsed += typeof g === "bigint" ? g : BigInt(g ?? 0);
    }

    // --- 1) Deploy WQ ---
    const wqFactory = new WQ__factory(wallet);
    const wqGasLimit = await deployGasLimit(provider, walletAddr, () => wqFactory.getDeployTransaction(), DEPLOY_GAS_FALLBACK, 6_000_000n);
    const wq = await wqFactory.deploy({ gasLimit: wqGasLimit });
    const wqDeployTx = wq.deployTransaction();
    assert.ok(wqDeployTx && wqDeployTx.hash);
    console.log("[1] WQ deploy tx id:", wqDeployTx.hash);
    addReceiptGas(await wqDeployTx.wait(1, 600_000));
    const wqAddress = wq.target;
    assert.ok(isAddress(wqAddress), "WQ address must be valid");
    const wqAddressNorm = getAddress(wqAddress);
    contractAddresses.wallet = walletAddr;
    contractAddresses.WQ = wqAddressNorm;
    txHashes.push(wqDeployTx.hash);

    // --- 2) Deploy QuantumSwapV2Factory ---
    const factoryFactory = new QuantumSwapV2Factory__factory(wallet);
    const factoryGasLimit = await deployGasLimit(provider, walletAddr, () => factoryFactory.getDeployTransaction(walletAddr), DEPLOY_GAS_FALLBACK, 6_000_000n);
    const factoryContract = await factoryFactory.deploy(walletAddr, { gasLimit: factoryGasLimit });
    const factoryDeployTx = factoryContract.deployTransaction();
    assert.ok(factoryDeployTx && factoryDeployTx.hash);
    console.log("[2] Factory deploy tx id:", factoryDeployTx.hash);
    addReceiptGas(await factoryDeployTx.wait(1, 600_000));
    const factoryAddress = factoryContract.target;
    assert.ok(isAddress(factoryAddress), "Factory address must be valid");
    const factoryAddressNorm = getAddress(factoryAddress);
    contractAddresses.Factory = factoryAddressNorm;
    txHashes.push(factoryDeployTx.hash);

    // --- 3) Deploy QuantumSwapV2Router02 (needs Factory + WQ) ---
    const routerFactory = new QuantumSwapV2Router02__factory(wallet);
    const routerGasLimit = await deployGasLimit(provider, walletAddr, () => routerFactory.getDeployTransaction(factoryAddressNorm, wqAddressNorm), DEPLOY_GAS_FALLBACK, 6_000_000n);
    const routerContract = await routerFactory.deploy(factoryAddressNorm, wqAddressNorm, {
      gasLimit: routerGasLimit,
    });
    const routerDeployTx = routerContract.deployTransaction();
    assert.ok(routerDeployTx && routerDeployTx.hash);
    console.log("[3] Router deploy tx id:", routerDeployTx.hash);
    addReceiptGas(await routerDeployTx.wait(1, 600_000));
    const routerAddress = routerContract.target;
    assert.ok(isAddress(routerAddress), "Router address must be valid");
    contractAddresses.Router = getAddress(routerAddress);
    txHashes.push(routerDeployTx.hash);

    // Verify Router view calls (ABI / contract interface)
    const routerFactoryFromContract = await routerContract.factory();
    const routerWethFromContract = await routerContract.WETH();
    assert.equal(getAddress(routerFactoryFromContract), factoryAddressNorm, "Router.factory() must match deployed Factory");
    assert.equal(getAddress(routerWethFromContract), wqAddressNorm, "Router.WETH() must match deployed WQ");

    // --- 4) Deploy two ERC20 tokens (SimpleERC20 with initial supply) ---
    const initialSupply = parseUnits("1000000", 18);
    const simpleErc20Factory = new ContractFactory(SIMPLE_ERC20_ABI, SIMPLE_ERC20_BYTECODE, wallet);
    const deploySimpleErc20 = async (name, symbol) => {
      const tx = simpleErc20Factory.getDeployTransaction(name, symbol, initialSupply);
      const nonce = await provider.getTransactionCount(walletAddr, "pending");
      const address = getCreateAddress({ from: walletAddr, nonce });
      const gasLimit = await estimateGasLimit(provider, { from: walletAddr, data: tx.data }, DEPLOY_GAS_FALLBACK);
      const resp = await wallet.sendTransaction({ ...tx, nonce, gasLimit });
      console.log("[4] ERC20 deploy tx id:", name, resp.hash);
      addReceiptGas(await resp.wait(1, 600_000));
      const contract = new Contract(address, SIMPLE_ERC20_ABI, wallet);
      contract._deployTx = resp;
      return contract;
    };
    const tokenA = await deploySimpleErc20("TokenA", "TKA");
    const tokenAAddress = getAddress(tokenA.target);
    assert.ok(isAddress(tokenAAddress), "TokenA address must be valid");
    contractAddresses.TokenA = tokenAAddress;
    txHashes.push(tokenA._deployTx.hash);

    const tokenB = await deploySimpleErc20("TokenB", "TKB");
    const tokenBAddress = getAddress(tokenB.target);
    assert.ok(isAddress(tokenBAddress), "TokenB address must be valid");
    contractAddresses.TokenB = tokenBAddress;
    txHashes.push(tokenB._deployTx.hash);

    // --- Balance checks: token A/B (SimpleERC20 mints to deployer) ---
    const tokenABalanceBeforeRaw = await tokenA.balanceOf(walletAddr);
    const tokenBBalanceBeforeRaw = await tokenB.balanceOf(walletAddr);
    const tokenABalanceBefore = typeof tokenABalanceBeforeRaw === "bigint" ? tokenABalanceBeforeRaw : BigInt(String(tokenABalanceBeforeRaw));
    const tokenBBalanceBefore = typeof tokenBBalanceBeforeRaw === "bigint" ? tokenBBalanceBeforeRaw : BigInt(String(tokenBBalanceBeforeRaw));
    assert.ok(tokenABalanceBefore >= initialSupply, "TokenA initial balance >= initialSupply");
    assert.ok(tokenBBalanceBefore >= initialSupply, "TokenB initial balance >= initialSupply");

    // --- 5) Create pair (tokenA, tokenB); parse PairCreated event when logs present (Interface.parseLog) ---
    const createPairTxReq = await factoryContract.populateTransaction.createPair(tokenAAddress, tokenBAddress);
    const createPairGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...createPairTxReq }, TX_GAS_FALLBACK);
    const createPairTx = await factoryContract.createPair(tokenAAddress, tokenBAddress, { gasLimit: createPairGasLimit });
    console.log("[5] createPair tx id:", createPairTx.hash);
    txHashes.push(createPairTx.hash);
    const createPairReceipt = await createPairTx.wait(1, 600_000);
    addReceiptGas(createPairReceipt);
    assert.ok(createPairReceipt, "createPair receipt must exist");

    // Pair address from Factory.getPair (ABI call) — source of truth
    const pairFromFactoryRaw = await factoryContract.getPair(tokenAAddress, tokenBAddress);
    let pairAddressFromEvent = null;
    try {
      pairAddressFromEvent = getAddress(pairFromFactoryRaw);
    } catch (e) {
      // Chain may return non-32-byte or invalid format
      pairAddressFromEvent = null;
    }
    const zeroAddress32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const pairCreated =
      pairAddressFromEvent &&
      isAddress(pairAddressFromEvent) &&
      pairAddressFromEvent !== zeroAddress32 &&
      pairAddressFromEvent !== "0x" + "0".repeat(64);
    if (pairCreated) contractAddresses.PairTokenATokenB = pairAddressFromEvent;

    // When receipt has logs, decode PairCreated using quantumcoin.js Interface.parseLog
    const logs = createPairReceipt.logs;
    if (Array.isArray(logs) && logs.length >= 1) {
      const factoryIface = new Interface(QuantumSwapV2Factory.abi);
      let parsedPairAddress = null;
      for (const log of logs) {
        if (!log.topics || !log.data) continue;
        try {
          const parsed = factoryIface.parseLog({ topics: log.topics, data: log.data });
          if (parsed && parsed.name === "PairCreated") {
            parsedPairAddress = parsed.args.pair ? getAddress(parsed.args.pair) : null;
            assert.ok(parsed.args.token0 && parsed.args.token1, "PairCreated should have token0 and token1");
            break;
          }
        } catch {
          // not this contract's event
        }
      }
      if (parsedPairAddress && pairCreated) {
        assert.equal(parsedPairAddress, pairAddressFromEvent, "PairCreated event pair must match getPair");
      }
    }

    // --- 6) Attach QuantumSwapV2Pair; reserves (when pair was created) ---
    if (pairCreated) {
      const pairContract = QuantumSwapV2Pair.connect(pairAddressFromEvent, provider);
      const reservesResult = await pairContract.getReserves();
      const reserve0 = Array.isArray(reservesResult) ? reservesResult[0] : reservesResult;
      const reserve1 = Array.isArray(reservesResult) ? reservesResult[1] : 0n;
      assert.ok(typeof reserve0 === "bigint" && typeof reserve1 === "bigint", "getReserves returns bigints");
      assert.equal(reserve0, 0n, "reserve0 before liquidity");
      assert.equal(reserve1, 0n, "reserve1 before liquidity");
    }

    // --- 7) Quote (getAmountsOut / getAmountsIn) — may revert with no liquidity; use try/catch ---
    const pathTokenAToB = [tokenAAddress, tokenBAddress];
    const amountIn = parseUnits("1", 18);
    let amountsOut = [];
    try {
      amountsOut = await routerContract.getAmountsOut(amountIn, pathTokenAToB);
    } catch (e) {
      // With no liquidity some chains revert
    }
    if (Array.isArray(amountsOut) && amountsOut.length >= 2) {
      const amountOutForOne = amountsOut[1];
      assert.ok(typeof amountOutForOne === "bigint", "amountOut is bigint");
      assert.ok(amountOutForOne === 0n || amountOutForOne > 0n, "amountOut is 0 or positive");
    }

    let amountsIn = [];
    try {
      const amountOutDesired = parseUnits("1", 18);
      amountsIn = await routerContract.getAmountsIn(amountOutDesired, pathTokenAToB);
    } catch (e) {
      // may revert with no liquidity
    }
    if (Array.isArray(amountsIn) && amountsIn.length >= 1) {
      assert.ok(amountsIn[0] !== undefined, "getAmountsIn[0] defined");
    }

    // --- 8) Add liquidity (tokenA/tokenB pair) ---
    if (pairCreated) {
      const amountADesired = parseUnits("1000", 18);
      const amountBDesired = parseUnits("1000", 18);
      const amountAMin = 0n;
      const amountBMin = 0n;
      const approveAmount = amountADesired > amountBDesired ? amountADesired : amountBDesired;
      const approveTxReqA = await tokenA.populateTransaction.approve(routerAddress, approveAmount);
      const approveGasA = await estimateGasLimit(provider, { from: walletAddr, ...approveTxReqA }, TX_GAS_FALLBACK);
      let approveA = await tokenA.approve(routerAddress, approveAmount, { gasLimit: approveGasA });
      console.log("[8a] tokenA approve tx id:", approveA.hash);
      txHashes.push(approveA.hash);
      addReceiptGas(await approveA.wait(1, 600_000));
      const approveTxReqB = await tokenB.populateTransaction.approve(routerAddress, approveAmount);
      const approveGasB = await estimateGasLimit(provider, { from: walletAddr, ...approveTxReqB }, TX_GAS_FALLBACK);
      let approveB = await tokenB.approve(routerAddress, approveAmount, { gasLimit: approveGasB });
      console.log("[8b] tokenB approve tx id:", approveB.hash);
      txHashes.push(approveB.hash);
      addReceiptGas(await approveB.wait(1, 600_000));
      const addLiqTxReq = await routerContract.populateTransaction.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        walletAddr,
        deadline(),
      );
      const addLiqGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...addLiqTxReq }, TX_GAS_FALLBACK);
      const tokenABalanceBeforeAddLiqRaw = await tokenA.balanceOf(walletAddr);
      const tokenBBalanceBeforeAddLiqRaw = await tokenB.balanceOf(walletAddr);
      const addLiqTx = await routerContract.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        walletAddr,
        deadline(),
        { gasLimit: addLiqGasLimit },
      );
      console.log("[8c] addLiquidity tx id:", addLiqTx.hash);
      txHashes.push(addLiqTx.hash);
      const addLiqReceipt = await addLiqTx.wait(1, 600_000);
      addReceiptGas(addLiqReceipt);
      assert.ok(addLiqReceipt && addLiqReceipt.status === 1, "addLiquidity must succeed");

      const pairContract = QuantumSwapV2Pair.connect(pairAddressFromEvent, provider);
      const reservesAfter = await pairContract.getReserves();
      const res0 = Array.isArray(reservesAfter) ? reservesAfter[0] : reservesAfter;
      const res1 = Array.isArray(reservesAfter) ? reservesAfter[1] : 0n;
      assert.ok(res0 > 0n && res1 > 0n, "reserves after addLiquidity > 0");
    }

    // --- 9) Swap: swapExactTokensForTokens (tokenA -> tokenB) ---
    if (pairCreated) {
      const swapAmountIn = parseUnits("10", 18);
      const amountOutMin = 0n;
      const pathSwap = [tokenAAddress, tokenBAddress];
      const approveSwapTxReq = await tokenA.populateTransaction.approve(routerAddress, swapAmountIn);
      const approveSwapGas = await estimateGasLimit(provider, { from: walletAddr, ...approveSwapTxReq }, TX_GAS_FALLBACK);
      const approveSwap = await tokenA.approve(routerAddress, swapAmountIn, { gasLimit: approveSwapGas });
      console.log("[9a] swap approve tx id:", approveSwap.hash);
      txHashes.push(approveSwap.hash);
      addReceiptGas(await approveSwap.wait(1, 600_000));
      const swapTxReq = await routerContract.populateTransaction.swapExactTokensForTokens(
        swapAmountIn,
        amountOutMin,
        pathSwap,
        walletAddr,
        deadline(),
      );
      const swapGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...swapTxReq }, TX_GAS_FALLBACK);
      const tokenBBalanceBeforeSwapRaw = await tokenB.balanceOf(walletAddr);
      const tokenBBalanceBeforeSwap = typeof tokenBBalanceBeforeSwapRaw === "bigint" ? tokenBBalanceBeforeSwapRaw : BigInt(String(tokenBBalanceBeforeSwapRaw));
      const swapTx = await routerContract.swapExactTokensForTokens(
        swapAmountIn,
        amountOutMin,
        pathSwap,
        walletAddr,
        deadline(),
        { gasLimit: swapGasLimit },
      );
      console.log("[9b] swapExactTokensForTokens tx id:", swapTx.hash);
      txHashes.push(swapTx.hash);
      const swapReceipt = await swapTx.wait(1, 600_000);
      addReceiptGas(swapReceipt);
      assert.ok(swapReceipt && swapReceipt.status === 1, "swapExactTokensForTokens must succeed");
      const tokenBBalanceAfterSwapRaw = await tokenB.balanceOf(walletAddr);
      const tokenBBalanceAfterSwap = typeof tokenBBalanceAfterSwapRaw === "bigint" ? tokenBBalanceAfterSwapRaw : BigInt(String(tokenBBalanceAfterSwapRaw));
      assert.ok(tokenBBalanceAfterSwap > tokenBBalanceBeforeSwap, "wallet TokenB balance must increase after swap");
    }

    // --- 10) Swap ETH: wrap, add WQ/token liquidity, swapExactETHForTokens ---
    if (pairCreated) {
      const ethToWrap = parseUnits("1", 18);
      const depositTxReq = await wq.populateTransaction.deposit({ value: ethToWrap });
      const depositGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...depositTxReq }, TX_GAS_FALLBACK);
      const depositTx = await wq.deposit({ value: ethToWrap, gasLimit: depositGasLimit });
      console.log("[10a] WQ deposit tx id:", depositTx.hash);
      txHashes.push(depositTx.hash);
      addReceiptGas(await depositTx.wait(1, 600_000));
      const wqBalanceAfterDepositRaw = await wq.balanceOf(walletAddr);
      const wqBalanceAfterDeposit = typeof wqBalanceAfterDepositRaw === "bigint" ? wqBalanceAfterDepositRaw : BigInt(String(wqBalanceAfterDepositRaw));
      assert.ok(wqBalanceAfterDeposit >= ethToWrap, "WQ balance after deposit >= ethToWrap");

      const pairWqTokenA = await factoryContract.getPair(wqAddressNorm, tokenAAddress);
      let pairWqTokenAAddr = null;
      try {
        pairWqTokenAAddr = getAddress(pairWqTokenA);
      } catch {
        pairWqTokenAAddr = null;
      }
      const zeroAddr = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const hasWqPair = pairWqTokenAAddr && isAddress(pairWqTokenAAddr) && pairWqTokenAAddr !== zeroAddr && pairWqTokenAAddr !== "0x" + "0".repeat(64);
      if (!hasWqPair) {
        const createWqPairTxReq = await factoryContract.populateTransaction.createPair(wqAddressNorm, tokenAAddress);
        const createWqPairGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...createWqPairTxReq }, TX_GAS_FALLBACK);
        const createWqPairTx = await factoryContract.createPair(wqAddressNorm, tokenAAddress, { gasLimit: createWqPairGasLimit });
        console.log("[10b] createPair WQ/tokenA tx id:", createWqPairTx.hash);
        txHashes.push(createWqPairTx.hash);
        addReceiptGas(await createWqPairTx.wait(1, 600_000));
        pairWqTokenAAddr = getAddress(await factoryContract.getPair(wqAddressNorm, tokenAAddress));
      }
      pairWqTokenAAddress = pairWqTokenAAddr;
      if (pairWqTokenAAddress) contractAddresses.PairWqTokenA = pairWqTokenAAddress;
      const tokenForEthLiq = parseUnits("500", 18);
      const approveTokenAForEthTxReq = await tokenA.populateTransaction.approve(routerAddress, tokenForEthLiq);
      const approveTokenAForEthGas = await estimateGasLimit(provider, { from: walletAddr, ...approveTokenAForEthTxReq }, TX_GAS_FALLBACK);
      const approveTokenAForEth = await tokenA.approve(routerAddress, tokenForEthLiq, { gasLimit: approveTokenAForEthGas });
      console.log("[10c] tokenA approve (ETH liq) tx id:", approveTokenAForEth.hash);
      txHashes.push(approveTokenAForEth.hash);
      addReceiptGas(await approveTokenAForEth.wait(1, 600_000));
      const addLiqEthTxReq = await routerContract.populateTransaction.addLiquidityETH(
        tokenAAddress,
        tokenForEthLiq,
        0n,
        0n,
        walletAddr,
        deadline(),
        { value: ethToWrap },
      );
      const addLiqEthGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...addLiqEthTxReq }, TX_GAS_FALLBACK);
      const addLiqEthTx = await routerContract.addLiquidityETH(
        tokenAAddress,
        tokenForEthLiq,
        0n,
        0n,
        walletAddr,
        deadline(),
        { value: ethToWrap, gasLimit: addLiqEthGasLimit },
      );
      console.log("[10d] addLiquidityETH tx id:", addLiqEthTx.hash);
      txHashes.push(addLiqEthTx.hash);
      addReceiptGas(await addLiqEthTx.wait(1, 600_000));

      const ethSwapValue = parseUnits("0.1", 18);
      const pathEthToToken = [wqAddressNorm, tokenAAddress];
      const swapEthTxReq = await routerContract.populateTransaction.swapExactETHForTokens(
        0n,
        pathEthToToken,
        walletAddr,
        deadline(),
        { value: ethSwapValue },
      );
      const swapEthGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...swapEthTxReq }, TX_GAS_FALLBACK);
      const tokenABalanceBeforeEthSwapRaw = await tokenA.balanceOf(walletAddr);
      const tokenABalanceBeforeEthSwap = typeof tokenABalanceBeforeEthSwapRaw === "bigint" ? tokenABalanceBeforeEthSwapRaw : BigInt(String(tokenABalanceBeforeEthSwapRaw));
      const swapEthTx = await routerContract.swapExactETHForTokens(
        0n,
        pathEthToToken,
        walletAddr,
        deadline(),
        { value: ethSwapValue, gasLimit: swapEthGasLimit },
      );
      console.log("[10e] swapExactETHForTokens tx id:", swapEthTx.hash);
      txHashes.push(swapEthTx.hash);
      const swapEthReceipt = await swapEthTx.wait(1, 600_000);
      addReceiptGas(swapEthReceipt);
      assert.ok(swapEthReceipt && swapEthReceipt.status === 1, "swapExactETHForTokens must succeed");
      const tokenABalanceAfterEthSwapRaw = await tokenA.balanceOf(walletAddr);
      const tokenABalanceAfterEthSwap = typeof tokenABalanceAfterEthSwapRaw === "bigint" ? tokenABalanceAfterEthSwapRaw : BigInt(String(tokenABalanceAfterEthSwapRaw));
      assert.ok(tokenABalanceAfterEthSwap > tokenABalanceBeforeEthSwap, "wallet TokenA balance must increase after swapExactETHForTokens");
    }

    // --- 11) Send tokens to another wallet ---
    const otherWallet = Wallet.createRandom().connect(provider);
    const otherAddr = getAddress(otherWallet.address);
    assert.ok(isAddress(otherAddr), "other wallet address must be valid");
    contractAddresses.OtherWallet = otherAddr;

    const transferAmountA = parseUnits("100", 18);
    const transferAmountB = parseUnits("100", 18);
    const transferATxReq = await tokenA.populateTransaction.transfer(otherAddr, transferAmountA);
    const transferAGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...transferATxReq }, TX_GAS_FALLBACK);
    const transferATx = await tokenA.transfer(otherAddr, transferAmountA, { gasLimit: transferAGasLimit });
    console.log("[11a] tokenA transfer to other wallet tx id:", transferATx.hash);
    txHashes.push(transferATx.hash);
    addReceiptGas(await transferATx.wait(1, 600_000));

    const transferBTxReq = await tokenB.populateTransaction.transfer(otherAddr, transferAmountB);
    const transferBGasLimit = await estimateGasLimit(provider, { from: walletAddr, ...transferBTxReq }, TX_GAS_FALLBACK);
    const transferBTx = await tokenB.transfer(otherAddr, transferAmountB, { gasLimit: transferBGasLimit });
    console.log("[11b] tokenB transfer to other wallet tx id:", transferBTx.hash);
    txHashes.push(transferBTx.hash);
    addReceiptGas(await transferBTx.wait(1, 600_000));

    const otherTokenABalanceRaw = await tokenA.balanceOf(otherAddr);
    const otherTokenBBalanceRaw = await tokenB.balanceOf(otherAddr);
    const otherTokenABalance = typeof otherTokenABalanceRaw === "bigint" ? otherTokenABalanceRaw : BigInt(String(otherTokenABalanceRaw));
    const otherTokenBBalance = typeof otherTokenBBalanceRaw === "bigint" ? otherTokenBBalanceRaw : BigInt(String(otherTokenBBalanceRaw));
    assert.equal(otherTokenABalance, transferAmountA, "other wallet must have received TokenA");
    assert.equal(otherTokenBBalance, transferAmountB, "other wallet must have received TokenB");

    // --- 12) Account balance check: native balance (before = nativeBalanceBeforeAllTxs at start) ---
    const nativeBalanceAfter = await provider.getBalance(walletAddr);
    assert.ok(typeof nativeBalanceAfter === "bigint", "native balance is bigint");
    assert.ok(nativeBalanceAfter >= 0n, "native balance non-negative");
    assert.ok(nativeBalanceAfter <= nativeBalanceBeforeAllTxs, "native balance decreased or unchanged after txs");

    const wqBalanceWallet = await wq.balanceOf(walletAddr);
    assert.ok(typeof wqBalanceWallet === "bigint", "WQ balance is bigint");

    // --- Summary: contract addresses and transaction hashes ---
    console.log("\n========== CONTRACT ADDRESSES ==========");
    for (const [name, addr] of Object.entries(contractAddresses)) {
      console.log(`  ${name}: ${addr}`);
    }
    console.log("\n========== TRANSACTION HASHES ==========");
    txHashes.forEach((hash, i) => {
      console.log(`  [${i + 1}] ${hash}`);
    });
    console.log("\n========== TOTAL GAS USED (cumulative) ==========");
    console.log(`  ${totalGasUsed.toString()} (from ${txHashes.length} transaction receipts)`);
    console.log("========================================\n");

    // Summary assertions
    assert.ok(isAddress(routerAddress) && isAddress(factoryAddress) && isAddress(wqAddress), "all core addresses valid");
    assert.ok(isAddress(tokenAAddress) && isAddress(tokenBAddress), "token addresses valid");
    assert.ok(!pairCreated || isAddress(pairAddressFromEvent), "pair address valid when pair created");
  }, { timeout: 300_000 });
});
