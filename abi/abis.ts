
export const MockERC20ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() pure returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function mint(address to, uint256 amount)",
  ] as const;
  
  export const PoolManagerABI = [
    "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) returns (int24 tick)",
    "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) returns (int128 amount0, int128 amount1)",
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) returns (int128 callerDelta, int128 feesAccrued)",
    "function donate(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint256 amount0, uint256 amount1, bytes hookData) returns (int128, int128)",
    "function unlock(bytes data) returns (bytes result)",
    "function sync(address currency)",
    "function take(address currency, address to, uint256 amount)",
    "function settle() payable returns (uint256)",
    "function settleFor(address recipient) payable returns (uint256)",
    "function clear(address currency, uint256 amount)",
    "function mint(address to, uint256 id, uint256 amount)",
    "function burn(address from, uint256 id, uint256 amount)",
    "function updateDynamicLPFee(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint24 newDynamicLPFee)",
    "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
    "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
    "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
    "event Donate(bytes32 indexed id, address indexed sender, uint256 amount0, uint256 amount1)",
  ] as const;
  
  export const VeilBookABI = [
    // core functions
    "function deposit(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, address currency, uint256 amount) payable",
    "function placeOrder(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, int24 tick, bool zeroForOne, bytes32 encAmountIn, bytes amountInProof) returns (bytes32 orderId)",
    "function cancelOrder(bytes32 orderId, uint64 plaintextUnfilled)",
    "function claimFill(bytes32 orderId, uint64 plaintextFilled)",
    // view functions
    "function getUserOrders(address user) view returns (bytes32[])",
    "function getOrder(bytes32 orderId) view returns (address owner, int24 tick, bool zeroForOne, bool active, uint256 amountIn, uint256 amountOut, uint256 filledIn, uint256 filledOut)",
    "function getOrderCount(bytes32 poolId, int24 tick, bool zeroForOne) view returns (uint256)",
    "function getEncryptedToken(bytes32 poolId, address currency) view returns (address)",
    "function getScaledPriceAtTick(int24 tick, bool zeroForOne) pure returns (uint256 scaledPrice)",
    "function lastTick(bytes32 poolId) view returns (int24)",
    // events
    "event OrderPlaced(bytes32 indexed orderId, address indexed owner, bytes32 indexed poolId, int24 tick, bool zeroForOne)",
    "event OrderCancelled(bytes32 indexed orderId, address indexed owner)",
    "event OrderClosed(bytes32 indexed orderId, address indexed owner)",
    "event FillClaimed(bytes32 indexed orderId, address indexed owner)",
    "event OrdersMatched(bytes32 indexed buyOrderId, bytes32 indexed sellOrderId, int24 tick)",
  ] as const;
  
  export const StateViewABI = [
    "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getTickInfo(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)",
    "function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)",
    "function getTickFeeGrowthOutside(bytes32 poolId, int24 tick) view returns (uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)",
    "function getFeeGrowthGlobals(bytes32 poolId) view returns (uint256 feeGrowthGlobal0, uint256 feeGrowthGlobal1)",
    "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
    "function getTickBitmap(bytes32 poolId, int16 tick) view returns (uint256 tickBitmap)",
    "function getPositionInfo(bytes32 poolId, address owner, int24 tickLower, int24 tickUpper, bytes32 salt) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)",
    "function getPositionLiquidity(bytes32 poolId, bytes32 positionId) view returns (uint128 liquidity)",
    "function getFeeGrowthInside(bytes32 poolId, int24 tickLower, int24 tickUpper) view returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128)",
  ] as const;
  
  export const PoolSwapTestABI = [
    "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, tuple(bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) payable returns (int128 amount0, int128 amount1)",
  ] as const;
  
  export const PoolModifyLiquidityTestABI = [
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) payable returns (int128, int128)",
    "function modifyLiquidity(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData, bool settleUsingBurn, bool takeClaims) payable returns (int128, int128)",
  ] as const;
  
  export const V4QuoterABI = [
    "function quoteExactInputSingle(tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, uint160 sqrtPriceLimitX96, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)",
    "function quoteExactInput(tuple(address exactCurrency, tuple(address intermediateCurrency, int24 fee, int24 tickSpacing, address hooks, bytes hookData)[] path, uint128 exactAmount) params) returns (uint256 amountOut, uint256 gasEstimate)",
    "function quoteExactOutputSingle(tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, uint160 sqrtPriceLimitX96, bytes hookData) params) returns (uint256 amountIn, uint256 gasEstimate)",
    "function quoteExactOutput(tuple(address exactCurrency, tuple(address intermediateCurrency, int24 fee, int24 tickSpacing, address hooks, bytes hookData)[] path, uint128 exactAmount) params) returns (uint256 amountIn, uint256 gasEstimate)",
  ] as const;
  
  // pool key helper — reuse this across your frontend
  export const POOL_KEYS = {
    USDC_NBL: {
      currency0: "0x000004861e9Cb0F096D4743474A83D4FD421F578",
      currency1: "0xFf2B8F49B569c625eC2c271765dE2418b8506ACE",
      fee: 3000,
      tickSpacing: 60,
      hooks: "0x203090B459Ce722f9F6467BC658F64B907e3D040",
    },
    USDC_SLR: {
      currency0: "0x000004861e9Cb0F096D4743474A83D4FD421F578",
      currency1: "0x84F8df19803B636f27a3947fD4D0c1b51C166426",
      fee: 3000,
      tickSpacing: 60,
      hooks: "0x203090B459Ce722f9F6467BC658F64B907e3D040",
    },
    USDC_ATH: {
      currency0: "0x000004861e9Cb0F096D4743474A83D4FD421F578",
      currency1: "0xa446cCB04E2B78Eb2cfC5B3e6b5960f90C3fE124",
      fee: 3000,
      tickSpacing: 60,
      hooks: "0x203090B459Ce722f9F6467BC658F64B907e3D040",
    },
    USDC_VTX: {
      currency0: "0x000004861e9Cb0F096D4743474A83D4FD421F578",
      currency1: "0xE9364b7510bd60A76F26718cF307150466C71516",
      fee: 3000,
      tickSpacing: 60,
      hooks: "0x203090B459Ce722f9F6467BC658F64B907e3D040",
    },
  } as const;