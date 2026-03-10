import { ethers } from "hardhat";

// addresses
const POOL_MANAGER = "0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D";
const USDC = "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d";

const TOKEN0s = [
  { symbol: "NBL", address: "" },
  { symbol: "SLR", address: "" },
  { symbol: "ATH", address: "" },
  { symbol: "VTX", address: "" },
  { symbol: "ZTA", address: "" },
];

const TICK_SPACING = 60;
const FEE = 3000;
const SQRT_PRICE_1_1 = BigInt("79228162514264337593543950336"); // 1:1 initial price

const HOOKS = "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Initializing pools with:", deployer.address);

  const poolManager = await ethers.getContractAt(
    [
      "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)",
    ],
    POOL_MANAGER
  );

  // generate pool keys
  const poolKeys = TOKEN0s.map(({ symbol, address }) => ({
    symbol,
    key: {
      currency0: address,   
      currency1: USDC,
      fee: FEE,
      tickSpacing: TICK_SPACING,
      hooks: HOOKS,
    },
  }));

  // log pool keys array for frontend
  console.log("\n=== Pool Keys (copy to frontend) ===\n");
  console.log(JSON.stringify(poolKeys.map(p => p.key), null, 2));

  // initialize each pool
  console.log("\n=== Initializing Pools ===\n");
  for (const { symbol, key } of poolKeys) {
    console.log(`Initializing ${symbol}/USDC pool...`);
    const tx = await poolManager.initialize(key, SQRT_PRICE_1_1);
    await tx.wait();
    console.log(`✅ ${symbol}/USDC pool initialized`);
  }

  console.log("\n✅ All pools initialized");
}

main().catch(console.error);

// npx hardhat run scripts/initializePools.ts --network sepolia


// NBL deployed at: 0x5EDB776E0e8324609276De545118E5f4ef0e820B
// SLR deployed at: 0x2f1b32866FFF6c5c48324806A94a3766cF69861D
// ATH deployed at: 0x3dC4270317C33873538EfBE05F22711F33187FEa
// VTX deployed at: 0x3C8330c0A975b77bc9d809b75d32ACee49C64cc9
// ZTA deployed at: 0xBce34969854a0950788f248D18B997b8b05798F9

// PoolManager deployed at: 0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D 
// PoolModifyLiquidityTest deployed at: 0x03361fA440BACEDCd807B7D419AA83865Abed9ee
// PoolSwapTest deployed at: 0xEF02dEC3B6E81850974A39c7B18a9fB1BB5b1758
// StateView deployed at: 0x626927daBdcff58d87643b666B65ce05ac85E9CA
// ✅ MockUSDC deployed at: 0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d
// VeilBook Hook deployed at: 0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040


[
  {
    "currency0": "",
    "currency1": "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d",
    "fee": 3000,
    "tickSpacing": 60,
    "hooks": "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040"
  },
  {
    "currency0": "",
    "currency1": "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d",
    "fee": 3000,
    "tickSpacing": 60,
    "hooks": "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040"
  },
  {
    "currency0": "",
    "currency1": "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d",
    "fee": 3000,
    "tickSpacing": 60,
    "hooks": "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040"
  },
  {
    "currency0": "",
    "currency1": "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d",
    "fee": 3000,
    "tickSpacing": 60,
    "hooks": "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040"
  },
  {
    "currency0": "",
    "currency1": "0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d",
    "fee": 3000,
    "tickSpacing": 60,
    "hooks": "0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040"
  }
]


