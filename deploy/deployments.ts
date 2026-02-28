
export default {


    ETH_ADDRESS: "0x0000000000000000000000000000000000000000",
    USDC_ADDRESS: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ADDRESS_ZERO: "0x0000000000000000000000000000000000000000",

    POOL_MANAGER_ADDRESS: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    POSITION_DESCRIPTOR_ADDRESS: "0xd1428ba554f4c8450b763a0b2040a4935c63f06c",
    POSITION_MANAGER_ADDRESS: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
    QUOTER_ADDRESS: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203",
    STATE_VIEW_ADDRESS: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
    UNIVERSAL_ROUTER_ADDRESS: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
    PERMIT2_ADDRESS: "0x000000000022D473030F116dDEE9F6B43aC78BA3",

    ERC20_ABI: [
        // The one you already had
        "function allowance(address owner, address spender) view returns (uint256)",
        
        // The ones you need for transferring/funding
        "function transfer(address to, uint256 amount) returns (bool)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)",
        
        // Helpful for logging/debugging
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
    ],

    POOL_MANAGER_ABI: [
        "function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)",
        "function unlock(bytes data) external returns (bytes)",
        "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
        "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)"
    ],
    POSITION_MANAGER_ABI: [
        "function modifyLiquidities(bytes unlockData, uint256 deadline) external payable",
        "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        
        "function ownerOf(uint256 tokenId) external view returns (address)",
        "function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity)",
        "function nextTokenId() external view returns (uint256)",
        
    ],
    QUOTER_ABI: [
        "function quoteExactInputSingle(tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) external returns (uint256 amountOut, uint256 gasEstimate)",
        
        "function quoteExactOutputSingle(tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) external returns (uint256 amountIn, uint256 gasEstimate)",
        
        "function quoteExactInput(tuple(address currencyIn, tuple(address intermediateCurrency, uint24 fee, int24 tickSpacing, address hooks)[] path, uint128 exactAmount) params) external returns (uint256 amountOut, uint256 gasEstimate)",
        
        "function quoteExactOutput(tuple(address currencyOut, tuple(address intermediateCurrency, uint24 fee, int24 tickSpacing, address hooks)[] path, uint128 exactAmount) params) external returns (uint256 amountIn, uint256 gasEstimate)",

    ],
    PERMIT2_ABI: [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
        "function allowance(address user, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)"
    ],

    STATE_VIEW_ABI: [
        "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
        "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)",
        "function getTickBitmap(bytes32 poolId, int16 wordPosition) external view returns (uint256 tickBitmap)",
        "function getTickInfo(bytes32 poolId, int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)"
    ],
    UNIVERSAL_ROUTER_ABI: [
        "function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable"
    ],

    ACTIONS: {
        // --- Liquidity Actions (PositionManager) ---
        INCREASE_LIQUIDITY: 0x00,              // 0
        DECREASE_LIQUIDITY: 0x01,              // 1
        MINT_POSITION: 0x02,                   // 2
        BURN_POSITION: 0x03,                   // 3
        INCREASE_LIQUIDITY_FROM_DELTAS: 0x04,  // 4
        MINT_POSITION_FROM_DELTAS: 0x05,       // 5
      
        // --- Swap Actions (Router) ---
        SWAP_EXACT_IN_SINGLE: 0x06,            // 6
        SWAP_EXACT_IN: 0x07,                   // 7
        SWAP_EXACT_OUT_SINGLE: 0x08,           // 8
        SWAP_EXACT_OUT: 0x09,                  // 9
      
        // --- Utility & Payments ---
        DONATE: 0x0a,                          // 10
        SETTLE: 0x0b,                          // 11
        SETTLE_ALL: 0x0c,                      // 12
        SETTLE_PAIR: 0x0d,                     // 13
        TAKE: 0x0e,                            // 14
        TAKE_ALL: 0x0f,                        // 15
        TAKE_PORTION: 0x10,                    // 16
        TAKE_PAIR: 0x11,                       // 17
        CLOSE_CURRENCY: 0x12,                  // 18
        CLEAR_OR_TAKE: 0x13,                   // 19
        SWEEP: 0x14,                           // 20
        WRAP: 0x15,                            // 21
        UNWRAP: 0x16,                          // 22
      
        // --- ERC-6909 Actions ---
        MINT_6909: 0x17,                       // 23
        BURN_6909: 0x18                        // 24
      },

    
};


 // Deploy PoolManager, StateView, PositionManager, Quoter, UniversalRouter and Permit2
 // In our case we are forking, so dont deploy, just compile and get the abi
 