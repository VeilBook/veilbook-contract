import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, ZeroAddress } from "ethers";
import type { MockERC20, VeilBook } from "../types";

// ── Uniswap V4 ABIs we need ───────────────────────────────────────────────────
const POOL_MANAGER_ABI = [
  "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)",
  "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function unlock(bytes calldata data) external returns (bytes memory)",
];

const MODIFY_LIQUIDITY_ROUTER_ABI = [
  "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable returns (tuple(int256 currency0, int256 currency1) callerDelta, tuple(int256 currency0, int256 currency1) feesAccrued)",
];

const SWAP_ROUTER_ABI = [
  "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, tuple(bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (tuple(int256 currency0, int256 currency1))",
];

// ── Constants ────────────────────────────────────────────────────────────────
// Real Uniswap V4 PoolManager on Ethereum Mainnet (used via forking)
// const POOL_MANAGER_ADDRESS = "0x000000000004444c5dc75cB358380D2e3dE08A90";

// sqrtPriceX96 for 1:1 price
const SQRT_PRICE_1_1 = "79228162514264337593543950336";

// Tick math constants
const MIN_SQRT_PRICE = BigInt("4295128739");
const MAX_SQRT_PRICE = BigInt("1461446703485210103287273052203988822378723970341");

// Hook flags — must match getHookPermissions()
// AFTER_INITIALIZE_FLAG = 0x0400, AFTER_SWAP_FLAG = 0x0080
const HOOK_FLAGS = BigInt("0x0480");

/**
 * @notice Compute a deterministic hook address with the correct flag bits
 * @dev Uniswap V4 validates hook flags by checking the lower bits of the address.
 *      We brute-force a salt until we find an address whose lower bits match.
 *      In production you'd use HookMiner — here we do it inline.
 */


// ── Helper: encode PoolKey ────────────────────────────────────────────────────
function encodePoolKey(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string
) {
  return { currency0, currency1, fee, tickSpacing, hooks };
}

// ── Helper: sort token addresses ─────────────────────────────────────────────
function sortTokens(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

// ── Helper: pool ID from key ──────────────────────────────────────────────────
function getPoolId(key: ReturnType<typeof encodePoolKey>): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    )
  );
}

// =============================================================================
//                              TEST SUITE
// =============================================================================

describe("VeilBook — ConfidentialLimitOrderHook", function () {
  // Long timeout for fork + mining hook address
  this.timeout(300000);

  // ── Signers ────────────────────────────────────────────────────────────────
  let deployer: Signer;
  let seller: Signer;
  let buyer: Signer;
  let sellerAddress: string;
  let buyerAddress: string;
  let hookAddress: string;

  // ── Contracts ─────────────────────────────────────────────────────────────
  let poolManager: Contract;
  let modifyLiquidityRouter: Contract;
  let swapRouter: Contract;
  let hook: VeilBook;
  let token0: MockERC20;
  let token1: MockERC20;
  let token0Address: string;
  let token1Address: string;

  // ── Pool ──────────────────────────────────────────────────────────────────
  let poolKey: ReturnType<typeof encodePoolKey>;
  let poolId: string;

  // ── Amounts ───────────────────────────────────────────────────────────────
  // Using 6-decimal tokens so amounts fit in euint64
  // 1 token = 1_000_000 (1e6)
  const SELLER_DEPOSIT = ethers.parseUnits("1", 6);    // 1 TOKEN0 (e.g. WETH with 6 dec)
  const BUYER_DEPOSIT  = ethers.parseUnits("2000", 6); // 2000 TOKEN1 (e.g. USDC)
  const LIQUIDITY_AMOUNT = ethers.parseUnits("100000", 6);

  const ORDER_TICK = 60; // valid for tickSpacing=60

  // ==========================================================================
  //                              SETUP
  // ==========================================================================

  before(async function () {
    [deployer, seller, buyer] = await ethers.getSigners();
    sellerAddress = await seller.getAddress();
    buyerAddress = await buyer.getAddress();

    console.log("\n  Deployer:", await deployer.getAddress());
    console.log("  Seller:  ", sellerAddress);
    console.log("  Buyer:   ", buyerAddress);

    // // ── 1. Connect to forked PoolManager ──────────────────────────────────
    // poolManager = new ethers.Contract(POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI, deployer);
    // console.log("\n  PoolManager:", POOL_MANAGER_ADDRESS);

    // Deploy PoolManager
    const PoolManagerFactory = await ethers.getContractFactory(
      "PoolManager",
      deployer
    );
    const poolManagerContract = await PoolManagerFactory.deploy(deployer);
    await poolManagerContract.waitForDeployment();
    poolManager = new ethers.Contract(
      await poolManagerContract.getAddress(),
      POOL_MANAGER_ABI,
      deployer
    );
    const POOL_MANAGER_ADDRESS = await poolManagerContract.getAddress();

    console.log("PoolManager deployed at:", POOL_MANAGER_ADDRESS);

//.............................................................................................


 // Step 1: Deploy DeterministicDeployFactory
 console.log("\n1. Deploying DeterministicDeployFactory...");
 const DeterministicDeployFactory = await ethers.getContractFactory("DeterministicDeployFactory");
 const factory = await DeterministicDeployFactory.deploy();
 await factory.waitForDeployment();
 const factoryAddress = await factory.getAddress();
 console.log("DeterministicDeployFactory deployed to:", factoryAddress);


 // Calculate the required hook flags
 console.log("\n3. Calculating required hook flags...");
const AFTER_INITIALIZE_FLAG = 1n << 4n;
const AFTER_SWAP_FLAG = 1n << 6n;


const requiredFlags = AFTER_INITIALIZE_FLAG | AFTER_SWAP_FLAG;
console.log("Required flags:", requiredFlags.toString(16));

// Get the bytecode for VeilBook Hook
console.log("\n4. Preparing VeilBook Hook bytecode...");
const VeilBookHookFactory = await ethers.getContractFactory("VeilBook");
const deploymentData = VeilBookHookFactory.getDeployTransaction(POOL_MANAGER_ADDRESS);
const bytecode = (await deploymentData).data as string;
console.log("Bytecode length:", bytecode.length);

// Step 5: Find a salt that gives us an address with the correct flags
console.log("\n5. Finding salt for correct address...");
console.log("This may take a while...");

let salt = 0n;
// let targetAddress = "";
let found = false;
const maxIterations = 100000; // Limit iterations for demo

for (let i = 0; i < maxIterations && !found; i++) {
  salt = BigInt(i);
  hookAddress = await factory.computeAddress(bytecode, salt);

  // Extract flags from address (last 2 bytes before the checksum)
  const addressBigInt = BigInt(hookAddress);
  const addressFlags = (addressBigInt >> 144n) & 0xFFFFn;

  // Check if the address flags match our required flags
  // The address must have the required bits set
  if ((addressFlags & requiredFlags) === requiredFlags) {
    found = true;
    console.log("\n✓ Found valid address!");
    console.log("Salt:", salt.toString());
    console.log("Address:", hookAddress);
    console.log("Address flags:", addressFlags.toString(16));
    break;
  }

  if (i % 10000 === 0 && i > 0) {
    console.log(`Tried ${i} salts...`);
  }
}

if (!found) {
  console.log("\n⚠ Could not find valid address in", maxIterations, "iterations");
  console.log("In production, you would continue searching or use a different namespace");
  console.log("\nAlternatively, you can:");
  console.log("1. Use Foundry's vm.etch() to deploy to any address (testing only)");
  console.log("2. Mine for a salt offchain with more iterations");
  console.log("3. Use the namespace trick: XOR with a namespace value");
  return;
}


  // Deploy the hook using the found salt................
  console.log("\n6. Deploying VeilBook to computed address...");
  const deployTx = await factory.deploy(bytecode, salt);
  await deployTx.wait();

  console.log("\n✓ VeilBook deployed successfully!");
  console.log("Address:", hookAddress);

  hook = VeilBookHookFactory.attach(hookAddress) as unknown as VeilBook;

  // Verify the deployment
  console.log("\n7. Verifying deployment...");
  const deployedCode = await ethers.provider.getCode(hookAddress);
  if (deployedCode !== "0x") {
    console.log("✓ Contract deployed and verified!");
  } else {
    console.log("✗ Deployment verification failed");
  }

  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log("DeterministicDeployFactory:", factoryAddress);
  console.log("PoolManager:", POOL_MANAGER_ADDRESS);
  console.log("VeilBook Hook:", hookAddress);
  console.log("Salt used:", salt.toString());
  console.log("=".repeat(80));

//.............................................................................................

    // ── 2. Deploy MockERC20 tokens (6 decimals) ───────────────────────────
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");

    const tokenA = await MockERC20Factory.deploy();
    await tokenA.waitForDeployment();

    const tokenB = await MockERC20Factory.deploy();
    await tokenB.waitForDeployment();

    // Sort tokens so currency0 < currency1
    [token0Address, token1Address] = sortTokens(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );

    token0 = tokenA.attach(token0Address) as MockERC20;
    token1 = tokenB.attach(token1Address) as MockERC20;

    console.log("\n  Token0:", token0Address);
    console.log("  Token1:", token1Address);

    // ── 3. Deploy PoolModifyLiquidityTest router ───────────────────────────
    const ModifyLiquidityFactory = await ethers.getContractFactory(
      "PoolModifyLiquidityTest",
      deployer
    );
    const modifyRouter = await ModifyLiquidityFactory.deploy(POOL_MANAGER_ADDRESS);
    await modifyRouter.waitForDeployment();
    modifyLiquidityRouter = new ethers.Contract(
      await modifyRouter.getAddress(),
      MODIFY_LIQUIDITY_ROUTER_ABI,
      deployer
    );
    console.log("\n  ModifyLiquidityRouter:", await modifyRouter.getAddress());

    // ── 4. Deploy PoolSwapTest router ─────────────────────────────────────
    const SwapRouterFactory = await ethers.getContractFactory("PoolSwapTest", deployer);
    const swapRouterContract = await SwapRouterFactory.deploy(POOL_MANAGER_ADDRESS);
    await swapRouterContract.waitForDeployment();
    swapRouter = new ethers.Contract(
      await swapRouterContract.getAddress(),
      SWAP_ROUTER_ABI,
      deployer
    );
    
    console.log("  SwapRouter:", await swapRouterContract.getAddress());
  

    // ── 6. Build PoolKey ───────────────────────────────────────────────────
    poolKey = encodePoolKey(token0Address, token1Address, 3000, 60, hookAddress);
    poolId = getPoolId(poolKey);
    console.log("\n  PoolId:", poolId);

    // ── 7. Initialize pool at 1:1 price ───────────────────────────────────
    console.log("\n  Initializing pool...");
    const initTx = await poolManager.initialize(poolKey, SQRT_PRICE_1_1);
    await initTx.wait();
    console.log("  Pool initialized ✓");

    // ── 8. Mint tokens and add liquidity ──────────────────────────────────
    console.log("\n  Minting tokens for liquidity...");
    const deployerAddress = await deployer.getAddress();

    await (await token0.mint(deployerAddress, LIQUIDITY_AMOUNT * 10n)).wait();
    await (await token1.mint(deployerAddress, LIQUIDITY_AMOUNT * 10n)).wait();

    // Approve routers
    await (await token0.approve(await modifyRouter.getAddress(), ethers.MaxUint256)).wait();
    await (await token1.approve(await modifyRouter.getAddress(), ethers.MaxUint256)).wait();
    await (await token0.approve(await swapRouterContract.getAddress(), ethers.MaxUint256)).wait();
    await (await token1.approve(await swapRouterContract.getAddress(), ethers.MaxUint256)).wait();

    console.log("  Adding liquidity...");

    // Tight range around current tick
    await modifyLiquidityRouter.modifyLiquidity(
      poolKey,
      { tickLower: -120, tickUpper: 120, liquidityDelta: ethers.parseEther("100"), salt: ethers.ZeroHash },
      "0x"
    );

    // Wide range for full coverage
    await modifyLiquidityRouter.modifyLiquidity(
      poolKey,
      { tickLower: -6000, tickUpper: 6000, liquidityDelta: ethers.parseEther("1000"), salt: ethers.ZeroHash },
      "0x"
    );

    console.log("  Liquidity added ✓");

    // ── 9. Fund test accounts ─────────────────────────────────────────────
    await (await token0.mint(sellerAddress, SELLER_DEPOSIT * 100n)).wait();
    await (await token1.mint(buyerAddress,  BUYER_DEPOSIT  * 100n)).wait();

    // Approve hook for deposits
    await (await token0.connect(seller).approve(hookAddress, ethers.MaxUint256)).wait();
    await (await token1.connect(buyer).approve(hookAddress,  ethers.MaxUint256)).wait();

    // Approve swap router
    await (await token0.connect(seller).approve(await swapRouterContract.getAddress(), ethers.MaxUint256)).wait();
    await (await token1.connect(buyer).approve(await swapRouterContract.getAddress(),  ethers.MaxUint256)).wait();

    console.log("  Accounts funded and approved ✓\n");
  });

  // ==========================================================================
  //                          DEPOSIT TESTS
  // ==========================================================================

  describe("deposit()", function () {
    it("should pull token0 from seller and hold in hook", async function () {
      const hookBalBefore = await token0.balanceOf(await hook.getAddress());
      const sellerBalBefore = await token0.balanceOf(sellerAddress);

      await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);

      const hookBalAfter = await token0.balanceOf(await hook.getAddress());
      const sellerBalAfter = await token0.balanceOf(sellerAddress);

      expect(hookBalAfter - hookBalBefore).to.equal(SELLER_DEPOSIT);
      expect(sellerBalBefore - sellerBalAfter).to.equal(SELLER_DEPOSIT);
    });

    it("should deploy a PoolEncryptedToken for token0", async function () {
      const encTokenAddr = await hook.getEncryptedToken(poolId, token0Address);
      expect(encTokenAddr).to.not.equal(ZeroAddress);
    });

    it("should pull token1 from buyer and hold in hook", async function () {
      const hookBalBefore = await token1.balanceOf(await hook.getAddress());

      await hook.connect(buyer).deposit(poolKey, token1Address, BUYER_DEPOSIT);

      const hookBalAfter = await token1.balanceOf(await hook.getAddress());
      expect(hookBalAfter - hookBalBefore).to.equal(BUYER_DEPOSIT);
    });

    it("should deploy a separate PoolEncryptedToken for token1", async function () {
      const encToken0 = await hook.getEncryptedToken(poolId, token0Address);
      const encToken1 = await hook.getEncryptedToken(poolId, token1Address);

      expect(encToken1).to.not.equal(ZeroAddress);
      expect(encToken0).to.not.equal(encToken1);
    });

    it("should reuse same PoolEncryptedToken on second deposit", async function () {
      const [addr1] = await ethers.getSigners();
      const addr1Address = await addr1.getAddress();

      await token0.mint(addr1Address, SELLER_DEPOSIT);
      await token0.connect(addr1).approve(await hook.getAddress(), ethers.MaxUint256);

      const tokenBefore = await hook.getEncryptedToken(poolId, token0Address);
      await hook.connect(addr1).deposit(poolKey, token0Address, SELLER_DEPOSIT);
      const tokenAfter = await hook.getEncryptedToken(poolId, token0Address);

      expect(tokenBefore).to.equal(tokenAfter);
    });

    it("should revert on zero amount", async function () {
      await expect(
        hook.connect(seller).deposit(poolKey, token0Address, 0)
      ).to.be.revertedWithCustomError(hook, "InvalidAmount");
    });

    it("should revert on invalid currency", async function () {
      const fakeToken = ethers.Wallet.createRandom().address;
      await expect(
        hook.connect(seller).deposit(poolKey, fakeToken, SELLER_DEPOSIT)
      ).to.be.revertedWithCustomError(hook, "InvalidCurrency");
    });
  });

  // ==========================================================================
  //                        PLACE ORDER TESTS
  // ==========================================================================

  // describe("placeOrder()", function () {
  //   let sellerOrderId: string;
  //   let buyerOrderId: string;

  //   before(async function () {
  //     // Ensure both have deposited
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT);
  //   });

  //   it("should place a sell order (zeroForOne=false) for seller", async function () {
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey,
  //       ORDER_TICK,
  //       false, // seller: zeroForOne=false
  //       ethers.ZeroHash, // mock encrypted amount (FHE no-op in hardhat)
  //       "0x"
  //     );
  //     const receipt = await tx.wait();

  //     // Get orderId from OrderPlaced event
  //     const event = receipt?.logs.find((log: any) => {
  //       try {
  //         const parsed = hook.interface.parseLog(log);
  //         return parsed?.name === "OrderPlaced";
  //       } catch { return false; }
  //     });
  //     expect(event).to.not.be.undefined;

  //     const parsed = hook.interface.parseLog(event!);
  //     sellerOrderId = parsed!.args.orderId;

  //     console.log("    Seller OrderId:", sellerOrderId);
  //   });

  //   it("should store seller order with correct public fields", async function () {
  //     const order = await hook.getOrder(sellerOrderId);
  //     expect(order.owner).to.equal(sellerAddress);
  //     expect(order.tick).to.equal(ORDER_TICK);
  //     expect(order.zeroForOne).to.equal(false);
  //     expect(order.active).to.equal(true);
  //   });

  //   it("should add seller order to order book", async function () {
  //     const count = await hook.getOrderCount(poolId, ORDER_TICK, false);
  //     expect(count).to.be.gte(1n);
  //   });

  //   it("should add seller order to user order list", async function () {
  //     const orders = await hook.getUserOrders(sellerAddress);
  //     expect(orders).to.include(sellerOrderId);
  //   });

  //   it("should place a buy order (zeroForOne=true) for buyer", async function () {
  //     const tx = await hook.connect(buyer).placeOrder(
  //       poolKey,
  //       ORDER_TICK,
  //       true, // buyer: zeroForOne=true
  //       ethers.ZeroHash,
  //       "0x"
  //     );
  //     const receipt = await tx.wait();

  //     const event = receipt?.logs.find((log: any) => {
  //       try {
  //         const parsed = hook.interface.parseLog(log);
  //         return parsed?.name === "OrderPlaced";
  //       } catch { return false; }
  //     });

  //     const parsed = hook.interface.parseLog(event!);
  //     buyerOrderId = parsed!.args.orderId;

  //     console.log("    Buyer OrderId:", buyerOrderId);
  //   });

  //   it("should store buyer order with correct public fields", async function () {
  //     const order = await hook.getOrder(buyerOrderId);
  //     expect(order.owner).to.equal(buyerAddress);
  //     expect(order.tick).to.equal(ORDER_TICK);
  //     expect(order.zeroForOne).to.equal(true);
  //     expect(order.active).to.equal(true);
  //   });

  //   it("should round non-aligned tick down to nearest spacing", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);

  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey,
  //       75, // should round to 60
  //       false,
  //       ethers.ZeroHash,
  //       "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const parsed = hook.interface.parseLog(event!);
  //     const order = await hook.getOrder(parsed!.args.orderId);
  //     expect(order.tick).to.equal(60n);
  //   });

  //   it("should round negative tick towards negative infinity", async function () {
  //     await hook.connect(buyer).deposit(poolKey, token1Address, BUYER_DEPOSIT);

  //     const tx = await hook.connect(buyer).placeOrder(
  //       poolKey,
  //       -75, // should round to -120
  //       true,
  //       ethers.ZeroHash,
  //       "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const parsed = hook.interface.parseLog(event!);
  //     const order = await hook.getOrder(parsed!.args.orderId);
  //     expect(order.tick).to.equal(-120n);
  //   });

  //   it("should revert if pool not initialized (no encrypted token)", async function () {
  //     const fakeKey = encodePoolKey(
  //       token0Address, token1Address, 500, 10,
  //       await hook.getAddress()
  //     );
  //     await expect(
  //       hook.connect(seller).placeOrder(fakeKey, 60, false, ethers.ZeroHash, "0x")
  //     ).to.be.revertedWithCustomError(hook, "PoolNotInitialized");
  //   });
  // });

  // ==========================================================================
  //                        CANCEL ORDER TESTS
  // ==========================================================================

  // describe("cancelOrder()", function () {
  //   let cancelOrderId: string;

  //   before(async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     cancelOrderId = hook.interface.parseLog(event!)!.args.orderId;
  //   });

  //   it("should mark order inactive after cancel", async function () {
  //     await hook.connect(seller).cancelOrder(cancelOrderId, SELLER_DEPOSIT);
  //     const order = await hook.getOrder(cancelOrderId);
  //     expect(order.active).to.equal(false);
  //   });

  //   it("should refund token0 to seller after cancel", async function () {
  //     // Place a new order to cancel
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     const balBefore = await token0.balanceOf(sellerAddress);
  //     await hook.connect(seller).cancelOrder(orderId, SELLER_DEPOSIT);
  //     const balAfter = await token0.balanceOf(sellerAddress);

  //     expect(balAfter - balBefore).to.equal(SELLER_DEPOSIT);
  //   });

  //   it("should revert if not order owner", async function () {
  //     // Place fresh order
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     await expect(
  //       hook.connect(buyer).cancelOrder(orderId, SELLER_DEPOSIT)
  //     ).to.be.revertedWithCustomError(hook, "NotOrderOwner");
  //   });

  //   it("should revert on double cancel", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     await hook.connect(seller).cancelOrder(orderId, SELLER_DEPOSIT);

  //     await expect(
  //       hook.connect(seller).cancelOrder(orderId, SELLER_DEPOSIT)
  //     ).to.be.revertedWithCustomError(hook, "OrderNotActive");
  //   });

  //   it("should revert if order not found", async function () {
  //     await expect(
  //       hook.connect(seller).cancelOrder(ethers.ZeroHash, SELLER_DEPOSIT)
  //     ).to.be.revertedWithCustomError(hook, "OrderNotFound");
  //   });
  // });

  // ==========================================================================
  //                     SWAP & SETTLEMENT TESTS
  // ==========================================================================

  // describe("afterSwap() settlement", function () {
  //   let sellerOrderId: string;
  //   let buyerOrderId: string;

  //   before(async function () {
  //     // Fresh deposits and orders for settlement tests
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT * 5n);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT  * 5n);

  //     // Place sell order at tick 60
  //     let tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     let receipt = await tx.wait();
  //     let event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     sellerOrderId = hook.interface.parseLog(event!)!.args.orderId;

  //     // Place buy order at tick 60
  //     tx = await hook.connect(buyer).placeOrder(
  //       poolKey, ORDER_TICK, true, ethers.ZeroHash, "0x"
  //     );
  //     receipt = await tx.wait();
  //     event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     buyerOrderId = hook.interface.parseLog(event!)!.args.orderId;

  //     console.log("\n    Seller order:", sellerOrderId);
  //     console.log("    Buyer  order:", buyerOrderId);
  //   });

  //   it("should update lastTick after swap", async function () {
  //     const tickBefore = await hook.lastTick(poolId);
  //     console.log("    Tick before swap:", tickBefore.toString());

  //     // Swap token1 → token0 (price goes UP)
  //     await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: false,
  //         amountSpecified: -BUYER_DEPOSIT,
  //         sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );

  //     const tickAfter = await hook.lastTick(poolId);
  //     console.log("    Tick after swap:", tickAfter.toString());

  //     // lastTick should update after swap
  //     expect(tickAfter).to.not.equal(tickBefore);
  //   });

  //   it("should trigger settlement when price crosses order tick", async function () {
  //     // Get current tick from PoolManager
  //     const slot0 = await poolManager.getSlot0(poolId);
  //     console.log("\n    Current tick:", slot0.tick.toString());

  //     // Swap up past tick 60 — this crosses our ORDER_TICK
  //     const swapTx = await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: false, // sell token1, buy token0 → price UP
  //         amountSpecified: -(BUYER_DEPOSIT * 10n),
  //         sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );
  //     const receipt = await swapTx.wait();

  //     // Check for OrdersMatched event
  //     const matchedEvents = receipt?.logs.filter((log: any) => {
  //       try {
  //         return hook.interface.parseLog(log)?.name === "OrdersMatched";
  //       } catch { return false; }
  //     });

  //     const slot0After = await poolManager.getSlot0(poolId);
  //     console.log("    Tick after swap:", slot0After.tick.toString());
  //     console.log("    OrdersMatched events:", matchedEvents?.length ?? 0);
  //   });

  //   it("should not settle orders at untouched ticks", async function () {
  //     // Place order at far tick
  //     const farTick = 300;
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, farTick, false, ethers.ZeroHash, "0x"
  //     );
  //     await tx.wait();

  //     const countBefore = await hook.getOrderCount(
  //       poolId,
  //       60, // rounded from 300 = 300 (300 % 60 = 0)
  //       false
  //     );

  //     // Small swap that won't reach tick 300
  //     await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: false,
  //         amountSpecified: -(BUYER_DEPOSIT / 100n),
  //         sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );

  //     const slot0 = await poolManager.getSlot0(poolId);
  //     console.log("\n    Tick after small swap:", slot0.tick.toString());

  //     // Order count at far tick should be unchanged
  //     const countAfter = await hook.getOrderCount(poolId, farTick, false);
  //     expect(countAfter).to.equal(countBefore > 0n ? countBefore : 1n);
  //   });

  //   it("should settle sell orders when price moves DOWN", async function () {
  //     const negTick = -60;

  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT);

  //     await hook.connect(seller).placeOrder(poolKey, negTick, false, ethers.ZeroHash, "0x");
  //     await hook.connect(buyer).placeOrder(poolKey,  negTick, true,  ethers.ZeroHash, "0x");

  //     const slot0Before = await poolManager.getSlot0(poolId);
  //     console.log("\n    Tick before down swap:", slot0Before.tick.toString());

  //     // Swap token0 → token1 (price goes DOWN)
  //     // Need token0 in deployer wallet for this swap
  //     await token0.mint(await deployer.getAddress(), SELLER_DEPOSIT * 20n);
  //     await token0.approve(await swapRouter.getAddress(), ethers.MaxUint256);

  //     const swapTx = await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: true, // sell token0 → price DOWN
  //         amountSpecified: -(SELLER_DEPOSIT * 10n),
  //         sqrtPriceLimitX96: MIN_SQRT_PRICE + 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );
  //     const receipt = await swapTx.wait();

  //     const slot0After = await poolManager.getSlot0(poolId);
  //     console.log("    Tick after down swap:", slot0After.tick.toString());
  //     expect(slot0After.tick).to.be.lt(slot0Before.tick);

  //     const matchedEvents = receipt?.logs.filter((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrdersMatched"; }
  //       catch { return false; }
  //     });
  //     console.log("    OrdersMatched events:", matchedEvents?.length ?? 0);
  //   });
  // });

  // ==========================================================================
  //                        CLAIM FILL TESTS
  // ==========================================================================

  // describe("claimFill()", function () {
  //   let claimSellerOrderId: string;
  //   let claimBuyerOrderId: string;

  //   before(async function () {
  //     // Fresh setup for claim tests
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT * 5n);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT  * 5n);

  //     let tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     let receipt = await tx.wait();
  //     let event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     claimSellerOrderId = hook.interface.parseLog(event!)!.args.orderId;

  //     tx = await hook.connect(buyer).placeOrder(
  //       poolKey, ORDER_TICK, true, ethers.ZeroHash, "0x"
  //     );
  //     receipt = await tx.wait();
  //     event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     claimBuyerOrderId = hook.interface.parseLog(event!)!.args.orderId;

  //     // Trigger settlement with large swap
  //     await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: false,
  //         amountSpecified: -(BUYER_DEPOSIT * 20n),
  //         sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );
  //   });

  //   it("seller should receive token1 after claimFill", async function () {
  //     const balBefore = await token1.balanceOf(sellerAddress);
  //     console.log("\n    Seller token1 before claim:", ethers.formatUnits(balBefore, 6));

  //     // Hardcoded filledOut — in real usage decrypt via Zama Relayer
  //     // Seller's filledOut = BUYER_DEPOSIT (received USDC from buyer)
  //     await hook.connect(seller).claimFill(claimSellerOrderId, BUYER_DEPOSIT);

  //     const balAfter = await token1.balanceOf(sellerAddress);
  //     console.log("    Seller token1 after claim:", ethers.formatUnits(balAfter, 6));

  //     expect(balAfter - balBefore).to.equal(BUYER_DEPOSIT);
  //   });

  //   it("buyer should receive token0 after claimFill", async function () {
  //     const balBefore = await token0.balanceOf(buyerAddress);
  //     console.log("\n    Buyer token0 before claim:", ethers.formatUnits(balBefore, 6));

  //     // Buyer's filledOut = SELLER_DEPOSIT (received token0 from seller)
  //     await hook.connect(buyer).claimFill(claimBuyerOrderId, SELLER_DEPOSIT);

  //     const balAfter = await token0.balanceOf(buyerAddress);
  //     console.log("    Buyer token0 after claim:", ethers.formatUnits(balAfter, 6));

  //     expect(balAfter - balBefore).to.equal(SELLER_DEPOSIT);
  //   });

  //   it("should revert claimFill with zero amount", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     await expect(
  //       hook.connect(seller).claimFill(orderId, 0)
  //     ).to.be.revertedWithCustomError(hook, "InvalidAmount");
  //   });

  //   it("should revert claimFill if not owner", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     await expect(
  //       hook.connect(buyer).claimFill(orderId, SELLER_DEPOSIT)
  //     ).to.be.revertedWithCustomError(hook, "NotOrderOwner");
  //   });

  //   it("should revert claimFill if order not found", async function () {
  //     await expect(
  //       hook.connect(seller).claimFill(ethers.ZeroHash, SELLER_DEPOSIT)
  //     ).to.be.revertedWithCustomError(hook, "OrderNotFound");
  //   });
  // });

  // ==========================================================================
  //                         VIEW FUNCTION TESTS
  // ==========================================================================

  // describe("view functions", function () {
  //   it("getOrder() returns correct public fields", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     const tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     const receipt = await tx.wait();
  //     const event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const orderId = hook.interface.parseLog(event!)!.args.orderId;

  //     const order = await hook.getOrder(orderId);
  //     expect(order.owner).to.equal(sellerAddress);
  //     expect(order.tick).to.equal(ORDER_TICK);
  //     expect(order.zeroForOne).to.equal(false);
  //     expect(order.active).to.equal(true);
  //   });

  //   it("getUserOrders() returns all orders for user", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT * 3n);

  //     const before = (await hook.getUserOrders(sellerAddress)).length;

  //     await hook.connect(seller).placeOrder(poolKey, 60,  false, ethers.ZeroHash, "0x");
  //     await hook.connect(seller).placeOrder(poolKey, 120, false, ethers.ZeroHash, "0x");
  //     await hook.connect(seller).placeOrder(poolKey, 180, false, ethers.ZeroHash, "0x");

  //     const after = (await hook.getUserOrders(sellerAddress)).length;
  //     expect(after - before).to.equal(3);
  //   });

  //   it("getOrderCount() returns correct count per tick and direction", async function () {
  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT * 2n);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT);

  //     const sellBefore = await hook.getOrderCount(poolId, ORDER_TICK, false);
  //     const buyBefore  = await hook.getOrderCount(poolId, ORDER_TICK, true);

  //     await hook.connect(seller).placeOrder(poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x");
  //     await hook.connect(seller).placeOrder(poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x");
  //     await hook.connect(buyer).placeOrder(poolKey,  ORDER_TICK, true,  ethers.ZeroHash, "0x");

  //     expect(await hook.getOrderCount(poolId, ORDER_TICK, false)).to.equal(sellBefore + 2n);
  //     expect(await hook.getOrderCount(poolId, ORDER_TICK, true)).to.equal(buyBefore  + 1n);
  //   });

  //   it("getEncryptedToken() returns correct token address", async function () {
  //     const addr = await hook.getEncryptedToken(poolId, token0Address);
  //     expect(addr).to.not.equal(ZeroAddress);
  //   });

  //   it("lastTick is initialized on pool creation", async function () {
  //     const tick = await hook.lastTick(poolId);
  //     // Should not be zero if pool was initialized and swaps happened
  //     expect(tick).to.not.equal(undefined);
  //   });
  // });

  // ==========================================================================
  //                     FULL FLOW: PLACE → SWAP → CLAIM
  // ==========================================================================

  // describe("Full flow: place → swap → claim", function () {
  //   it("complete order lifecycle for both seller and buyer", async function () {
  //     console.log("\n  === Full Flow Test ===");

  //     // 1. Deposit
  //     const sellerToken0Before = await token0.balanceOf(sellerAddress);
  //     const buyerToken1Before  = await token1.balanceOf(buyerAddress);

  //     await hook.connect(seller).deposit(poolKey, token0Address, SELLER_DEPOSIT);
  //     await hook.connect(buyer).deposit(poolKey,  token1Address, BUYER_DEPOSIT);

  //     console.log("\n  After deposit:");
  //     console.log("    Hook token0 balance:", ethers.formatUnits(await token0.balanceOf(await hook.getAddress()), 6));
  //     console.log("    Hook token1 balance:", ethers.formatUnits(await token1.balanceOf(await hook.getAddress()), 6));

  //     // 2. Place orders
  //     let tx = await hook.connect(seller).placeOrder(
  //       poolKey, ORDER_TICK, false, ethers.ZeroHash, "0x"
  //     );
  //     let receipt = await tx.wait();
  //     let event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const sellOid = hook.interface.parseLog(event!)!.args.orderId;

  //     tx = await hook.connect(buyer).placeOrder(
  //       poolKey, ORDER_TICK, true, ethers.ZeroHash, "0x"
  //     );
  //     receipt = await tx.wait();
  //     event = receipt?.logs.find((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrderPlaced"; }
  //       catch { return false; }
  //     });
  //     const buyOid = hook.interface.parseLog(event!)!.args.orderId;

  //     console.log("\n  Orders placed at tick:", ORDER_TICK);

  //     // 3. Get tick before swap
  //     const slot0Before = await poolManager.getSlot0(poolId);
  //     console.log("  Tick before swap:", slot0Before.tick.toString());

  //     // 4. Swap to move price past ORDER_TICK
  //     const swapTx = await swapRouter.swap(
  //       poolKey,
  //       {
  //         zeroForOne: false,
  //         amountSpecified: -(BUYER_DEPOSIT * 5n),
  //         sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n,
  //       },
  //       { takeClaims: false, settleUsingBurn: false },
  //       "0x"
  //     );
  //     const swapReceipt = await swapTx.wait();

  //     const slot0After = await poolManager.getSlot0(poolId);
  //     console.log("  Tick after swap:", slot0After.tick.toString());

  //     const matchedEvents = swapReceipt?.logs.filter((log: any) => {
  //       try { return hook.interface.parseLog(log)?.name === "OrdersMatched"; }
  //       catch { return false; }
  //     });
  //     console.log("  OrdersMatched events:", matchedEvents?.length ?? 0);

  //     // 5. Claim fills
  //     const sellerToken1Before = await token1.balanceOf(sellerAddress);
  //     const buyerToken0Before  = await token0.balanceOf(buyerAddress);

  //     await hook.connect(seller).claimFill(sellOid, BUYER_DEPOSIT);
  //     await hook.connect(buyer).claimFill(buyOid,  SELLER_DEPOSIT);

  //     const sellerToken1After = await token1.balanceOf(sellerAddress);
  //     const buyerToken0After  = await token0.balanceOf(buyerAddress);

  //     console.log("\n  Seller received token1:", ethers.formatUnits(sellerToken1After - sellerToken1Before, 6));
  //     console.log("  Buyer  received token0:", ethers.formatUnits(buyerToken0After  - buyerToken0Before,  6));

  //     expect(sellerToken1After - sellerToken1Before).to.equal(BUYER_DEPOSIT);
  //     expect(buyerToken0After  - buyerToken0Before).to.equal(SELLER_DEPOSIT);

  //     console.log("\n  Full flow completed ✓");
  //   });
  // });
});
