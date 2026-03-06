// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {FHE, externalEuint64, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {PoolEncryptedToken} from "./tokens/PoolEncryptedToken.sol";
import {OrderTypes} from "./libraries/OrderTypes.sol";
import {FHEPermissions} from "./libraries/FHEPermissions.sol";


/**
 * @title VeilBook
 * @notice The order book that only you can read.
 *
 * @dev Confidential limit orders on Uniswap V4, powered by Zama fhEVM.
 *      Set your price, veil your size. When the market reaches your tick,
 *      VeilBook matches you peer-to-peer — no AMM, no exposure, no MEV.
 *      Because when searchers can't see your order size, there's nothing to front-run.
 *
 * Key design decisions:
 *   - User only encrypts amountIn. amountOut is computed on-chain from
 *     TickMath.getSqrtPriceAtTick(tick) — deterministic, trustless, no user input needed.
 *   - euint64 used throughout (euint64 overflows for wei-denominated amounts * price)
 *   - Tick loop direction matches TakeProfitsHook pattern:
 *       price UP   → settle zeroForOne=true  orders (buyers)
 *       price DOWN → settle zeroForOne=false orders (sellers)
 *   - Peer-to-peer settlement — no AMM touched during matching
 *   - Partial fills via FHE.min() on remaining amounts,
 */
contract VeilBook is
    BaseHook,
    ReentrancyGuard,
    ZamaEthereumConfig
{
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    // =============================================================
    //                           ERRORS
    // =============================================================

    error NotOrderOwner();
    error OrderNotFound();
    error OrderNotActive();
    error InvalidAmount();
    error InvalidCurrency();
    error PoolNotInitialized();

    // Add these temporary debug events at the top of your contract
    event Debug(string message);


    // =============================================================
    //                        STATE VARIABLES
    // =============================================================

    /**
     * @notice Order book: poolId => tick => zeroForOne => orderId[]
     * zeroForOne = true  → buyer  (locked currency1, wants currency0)
     * zeroForOne = false → seller (locked currency0, wants currency1)
     */
    mapping(PoolId => mapping(int24 => mapping(bool => bytes32[]))) public orderBook;

    /// @notice Order storage: orderId => LimitOrder
    mapping(bytes32 => OrderTypes.LimitOrder) public orders;

    /// @notice All order IDs per user (for client-side enumeration)
    mapping(address => bytes32[]) public userOrders;

    /// @notice Encrypted tokens per pool and currency
    mapping(PoolId => mapping(Currency => PoolEncryptedToken)) public poolEncryptedTokens;

    /// @notice Last known tick per pool
    mapping(PoolId => int24) public lastTick;

    /// @notice Order ID counter
    uint256 private _orderCounter;

    /// @notice Maximum orders matched per tick per swap (gas safety bound)
    uint256 public constant MAX_ORDERS_PER_SETTLE = 5;

    /// @notice Price scaling factor for fixed-point arithmetic
    /// Using 1e18 as scale — FullMath.mulDiv handles overflow safely
    uint256 private constant PRICE_SCALE = 1e6;

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    constructor(IPoolManager _poolManager)
        BaseHook(_poolManager)
    {}

    // =============================================================
    //                    HOOK CONFIGURATION
    // =============================================================

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // =============================================================
    //                     HOOK IMPLEMENTATIONS
    // =============================================================

    /// @notice Capture the initial tick when a pool is initialized
    function _afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24 tick
    ) internal override returns (bytes4) {
        lastTick[key.toId()] = tick;
        return BaseHook.afterInitialize.selector;
    }

   
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // Avoid re-entrancy from hook-initiated swaps (not applicable here
        // since we don't swap, but good practice to keep)
        

        if (sender == address(this)) return (BaseHook.afterSwap.selector, 0);

        PoolId poolId = key.toId();
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);
        int24 prevTick = lastTick[poolId];
        lastTick[poolId] = currentTick;

        if (currentTick == prevTick) {
            return (BaseHook.afterSwap.selector, 0);
        }

        int24 spacing = key.tickSpacing;

        if (currentTick > prevTick) {
            int24 startTick = _roundTickDown(prevTick, spacing);
            for (int24 tick = startTick; tick <= currentTick; tick += spacing) {
                _settleAtTick(poolId, key, tick);
            }
        } else {
            int24 startTick = _roundTickDown(prevTick, spacing);
            for (int24 tick = startTick; tick >= currentTick; tick -= spacing) {
                _settleAtTick(poolId, key, tick);
            }
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // =============================================================
    //                       CORE FUNCTIONS
    // =============================================================

    /**
     * @notice Deposit ERC20 or ETH and receive encrypted pool tokens
     *
     * @dev  Seller  (zeroForOne=true)  deposits currency0 (e.g. ETH)
     *       Buyer (zeroForOne=false) deposits currency1 (e.g. USDC)
     *
     * @param key      Pool key
     * @param currency Which currency to deposit (must be currency0 or currency1)
     * @param amount   Plaintext amount
     */
    function deposit(
        PoolKey calldata key,
        Currency currency,
        uint256 amount
    ) external payable nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _validateCurrency(key, currency);

        PoolId poolId = key.toId();
        PoolEncryptedToken encToken = _getOrCreateEncryptedToken(poolId, currency, key);

        // Pull ETH or ERC20
        if (Currency.unwrap(currency) == address(0)) {
            require(msg.value == amount, "Insufficient ETH");
        } else {
            IERC20(Currency.unwrap(currency)).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Wrap into euint64 and mint to user
        euint64 encAmount = FHE.asEuint64(uint64(amount));
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);        // user can decrypt their own balance
        FHE.allow(encAmount, address(encToken)); // token contract can operate on it

        encToken.mint(msg.sender, encAmount);
    }

    /**
     *
     * @param key            Pool key
     * @param tick           Target tick — rounded down to tickSpacing boundary
     * @param zeroForOne     true = seller (locked currency0, wants currency1)
     *                       false = buyer (locked currency1, wants currency0)
     * @param encAmountIn    Encrypted deposit amount (euint64)
     * @param amountInProof  ZKP proof for encAmountIn
     * @return orderId       Unique identifier for this order
     */
    function placeOrder(
        PoolKey calldata key,
        int24 tick,
        bool zeroForOne,
        externalEuint64 encAmountIn,
        bytes calldata amountInProof
    ) external nonReentrant returns (bytes32 orderId) {

        int24 usableTick = _roundTickDown(tick, key.tickSpacing);
        PoolId poolId = key.toId();

        // Convert encrypted input to internal handle
        euint64 amountIn = FHE.fromExternal(encAmountIn, amountInProof);

        // Compute amountOut from tick price — plaintext math, no FHE cost
        // This is the on-chain price computation that makes VeilBook novel
        uint256 scaledPrice = getScaledPriceAtTick(usableTick, zeroForOne);

        // Compute encrypted amountOut = amountIn * scaledPrice / PRICE_SCALE
        // FHE.mul(euint64, plaintext_uint64) is cheaper than euint64 * euint64
        euint64 amountOut = FHE.div(
            FHE.mul(amountIn, FHE.asEuint64(uint64(scaledPrice))),
            // FHE.asEuint64(uint64(PRICE_SCALE))
            uint64(PRICE_SCALE)

        );

        // Buyer  (zeroForOne=true)  deposits currency0
        // Seller (zeroForOne=false) deposits currency1
        Currency depositCurrency = zeroForOne ? key.currency0 : key.currency1;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][depositCurrency];
        if (address(encToken) == address(0)) revert PoolNotInitialized();

        // Grant FHE permissions
        FHEPermissions.grantPlaceOrderPermissions(amountIn, amountOut, msg.sender, address(encToken));

        // Initialize fill counters at 0
        euint64 filledIn  = FHE.asEuint64(0);
        euint64 filledOut = FHE.asEuint64(0);
        FHEPermissions.grantFilledPermissions(filledIn, filledOut, msg.sender);

        // Pull encrypted collateral
        // User must have called encToken.setOperator(hookAddress, until) on frontend
        FHE.allowTransient(amountIn, address(encToken));
        encToken.confidentialTransferFrom(msg.sender, address(this), amountIn);

        // Generate unique order ID
        orderId = keccak256(abi.encode(msg.sender, poolId, usableTick, zeroForOne, _orderCounter++));

        // Store order
        orders[orderId] = OrderTypes.LimitOrder({
            owner:      msg.sender,
            tick:       usableTick,
            zeroForOne: zeroForOne,
            active:     true,
            poolKey:    key,
            amountIn:   amountIn,
            amountOut:  amountOut,
            filledIn:   filledIn,
            filledOut:  filledOut
        });

        orderBook[poolId][usableTick][zeroForOne].push(orderId);
        userOrders[msg.sender].push(orderId);

        emit OrderTypes.OrderPlaced(orderId, msg.sender, poolId, usableTick, zeroForOne);
    }

    /**
     * @notice Cancel an active order and reclaim unfilled collateral
     *
     * @param orderId           Order to cancel
     * @param plaintextUnfilled Unfilled deposit amount (decrypted client-side)
     */
    function cancelOrder(
        bytes32 orderId,
        uint64 plaintextUnfilled
    ) external nonReentrant {
        OrderTypes.LimitOrder storage order = orders[orderId];
        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert NotOrderOwner();
        if (!order.active) revert OrderNotActive();

        // Effects before interactions
        order.active = false;

        PoolKey memory key = order.poolKey;
        PoolId poolId = key.toId();

        // Deposit currency = what they originally locked
        Currency depositCurrency = order.zeroForOne ? key.currency0 : key.currency1;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][depositCurrency];

        // Re-encrypt, burn, refund
        euint64 encUnfilled = FHE.asEuint64(plaintextUnfilled);
        FHEPermissions.grantCancelPermissions(encUnfilled, msg.sender, address(encToken));
        encToken.burn(msg.sender, encUnfilled);
        _transferOut(depositCurrency, msg.sender, plaintextUnfilled);

        emit OrderTypes.OrderCancelled(orderId, msg.sender);
        emit OrderTypes.OrderClosed(orderId, msg.sender);
    }

    /**
     * @notice Claim filled proceeds after (partial or full) order execution
     *
     * @dev Flow:
     *   1. Call getOrder(orderId) to get the filledOut euint64 handle
     *   2. Decrypt filledOut client-side via Zama Relayer
     *   3. Call claimFill(orderId, decryptedFilledOut)
     *
     *   Outgoing currency = what counterparty deposited:
     *     Seller  (zeroForOne=true)  receives currency1 (what buyer locked)
     *     Buyer (zeroForOne=false) receives currency0 (what seller locked)
     *
     * @param orderId          Order to claim from
     * @param plaintextFilled  filledOut amount (decrypted client-side)
     */
    function claimFill(
        bytes32 orderId,
        uint64 plaintextFilled
    ) external nonReentrant {
        OrderTypes.LimitOrder storage order = orders[orderId];
        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert NotOrderOwner();
        if (plaintextFilled == 0) revert InvalidAmount();

        PoolKey memory key = order.poolKey;
        PoolId poolId = key.toId();

        // Outgoing = opposite of deposit currency
        // Buyer  (zeroForOne=true)  deposited currency1 → receives currency0
        // Seller (zeroForOne=false) deposited currency0 → receives currency1
        Currency outCurrency = order.zeroForOne ? key.currency1 : key.currency0;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][outCurrency];

        // Re-encrypt, burn, send
        euint64 encClaimed = FHE.asEuint64(plaintextFilled);
        FHEPermissions.grantClaimPermissions(encClaimed, msg.sender, address(encToken));
        encToken.burn(msg.sender, encClaimed);
        _transferOut(outCurrency, msg.sender, plaintextFilled);

        emit OrderTypes.FillClaimed(orderId, msg.sender);
    }

    

    // =============================================================
    //                     SETTLEMENT LOGIC
    // =============================================================

    /**
     * @notice Match buy and sell orders at a specific tick
     *
     * @param poolId  Pool being settled
     * @param key     Pool key
     * @param tick    Tick to settle
     
     */

    function _settleAtTick(
        PoolId poolId,
        PoolKey calldata key,
        int24 tick
    ) internal {
       
        
        bytes32[] storage sellOrders = orderBook[poolId][tick][true];   // selling token0
        bytes32[] storage buyOrders  = orderBook[poolId][tick][false];  // selling token1

        if (buyOrders.length == 0 || sellOrders.length == 0) return;

        PoolEncryptedToken encToken0 = poolEncryptedTokens[poolId][key.currency0];
        PoolEncryptedToken encToken1 = poolEncryptedTokens[poolId][key.currency1];

        uint256 bi = 0;
        uint256 si = 0;
        uint256 iterations = 0;

        while (
            bi < buyOrders.length &&
            si < sellOrders.length &&
            iterations < MAX_ORDERS_PER_SETTLE
        ) {
            OrderTypes.LimitOrder storage buy = orders[buyOrders[bi]];
            OrderTypes.LimitOrder storage sell = orders[sellOrders[si]];
            emit Debug("matching pair");

            if (!buy.active)  { bi++; continue; }
            if (!sell.active) { si++; continue; }

            // ── Remaining amounts ─────────────────────────────────────────
            euint64 sellRemainingIn = FHE.sub(sell.amountIn, sell.filledIn);
            euint64 buyRemainingOut = FHE.sub(buy.amountOut, buy.filledOut);
            euint64 buyRemainingIn = FHE.sub(buy.amountIn, buy.filledIn);
            euint64 sellRemainingOut = FHE.sub(sell.amountOut, sell.filledOut);

            // ── Fill amounts (same-unit) ──────────────────────────────────
            euint64 fillIn = FHE.min(sellRemainingIn, buyRemainingOut);  // currency0
            euint64 fillOut = FHE.min(buyRemainingIn, sellRemainingOut); // currency1

            // ── Update fill counters ──────────────────────────────────────
            euint64 newSellFilledIn = FHE.add(sell.filledIn, fillIn);
            euint64 newSellFilledOut = FHE.add(sell.filledOut, fillOut);
            euint64 newBuyFilledIn = FHE.add(buy.filledIn, fillOut);
            euint64 newBuyFilledOut = FHE.add(buy.filledOut, fillIn);

            // ── Grant ACL for all new handles ─────────────────────────────
            FHEPermissions.grantSettlementPermissions(
                fillIn,
                fillOut,
                newBuyFilledIn,
                newBuyFilledOut,
                newSellFilledIn,
                newSellFilledOut,
                buy.owner,
                sell.owner,
                address(encToken0),
                address(encToken1)
            );

            // ── Persist ───────────────────────────────────────────────────
            sell.filledIn = newSellFilledIn;
            sell.filledOut = newSellFilledOut;
            buy.filledIn = newBuyFilledIn;
            buy.filledOut = newBuyFilledOut;

            // ── Token transfers ───────────────────────────────────────────

            // Seller (zeroForOne=true) locked currency0 → buyer receives currency0
            encToken0.hookTransfer(address(this), buy.owner, fillIn);

            // Buyer (zeroForOne=false) locked currency1 → seller receives currency1
            encToken1.hookTransfer(address(this), sell.owner, fillOut);

            emit OrderTypes.OrdersMatched(buyOrders[bi], sellOrders[si], tick);

            bi++;
            si++;
            iterations++;
        }
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================


    function getUserOrders(address user) external view returns (bytes32[] memory) {
        return userOrders[user];
    }

    function getOrder(bytes32 orderId) external view returns (
        address owner,
        int24 tick,
        bool zeroForOne,
        bool active,
        euint64 amountIn,   // handle — decrypt client-side via Relayer + KMS
        euint64 amountOut,  // handle — decrypt client-side via Relayer + KMS
        euint64 filledIn,   // handle — decrypt client-side via Relayer + KMS
        euint64 filledOut   // handle — decrypt client-side via Relayer + KMS
    ) {
        OrderTypes.LimitOrder storage o = orders[orderId];
        return (o.owner, o.tick, o.zeroForOne, o.active, o.amountIn, o.amountOut, o.filledIn, o.filledOut);
    }

    function getOrderCount(PoolId poolId, int24 tick, bool zeroForOne) external view returns (uint256) {
        return orderBook[poolId][tick][zeroForOne].length;
    }

    function getEncryptedToken(PoolId poolId, Currency currency) external view returns (address) {
        return address(poolEncryptedTokens[poolId][currency]);
    }

    function getEncryptedTokenContract(PoolId poolId, Currency currency) external view returns (PoolEncryptedToken) {
        return poolEncryptedTokens[poolId][currency];
    }

    // =============================================================
    //                      HELPER FUNCTIONS
    // =============================================================

    /**
     * @notice Compute scaled price at a tick for amountOut calculation
     *
     * @param tick        The order tick
     * @param zeroForOne  Order direction
     * @return scaledPrice Price scaled by PRICE_SCALE for use in FHE.mul / FHE.div
     */
    function getScaledPriceAtTick(
        int24 tick,
        bool zeroForOne
    ) public pure returns (uint256 scaledPrice) {
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);

        // price = sqrtPriceX96^2 / 2^192, scaled by PRICE_SCALE
        // Use FullMath.mulDiv for BOTH the squaring and scaling to avoid overflow
        uint256 price = FullMath.mulDiv(
            FullMath.mulDiv(
                uint256(sqrtPriceX96),
                uint256(sqrtPriceX96),
                1 << 96          // divide out one 2^96
            ),
            PRICE_SCALE,
            1 << 96              // divide out the second 2^96
        );

        if (zeroForOne) {
            scaledPrice = price;
        } else {
            // Guard against price = 0 (extreme negative ticks)
            require(price > 0, "price underflow");
            scaledPrice = FullMath.mulDiv(PRICE_SCALE, PRICE_SCALE, price);
        }
    }

    function _getOrCreateEncryptedToken(
        PoolId poolId,
        Currency currency,
        PoolKey calldata key
    ) internal returns (PoolEncryptedToken) {
        PoolEncryptedToken existing = poolEncryptedTokens[poolId][currency];
        if (address(existing) != address(0)) return existing;

        string memory symbol = _getCurrencySymbol(currency);
        PoolEncryptedToken newToken = new PoolEncryptedToken(
            Currency.unwrap(currency),
            PoolId.unwrap(poolId),
            address(this),
            string(abi.encodePacked("Confidential ", symbol)),
            string(abi.encodePacked("c", symbol)),
            ""
        );

        poolEncryptedTokens[poolId][currency] = newToken;
        return newToken;
    }

    function _getCurrencySymbol(Currency currency) internal view returns (string memory) {
        if (Currency.unwrap(currency) == address(0)) return "ETH";
        try IERC20Metadata(Currency.unwrap(currency)).symbol() returns (string memory s) {
            return s;
        } catch {
            return "TOKEN";
        }
    }

    function _validateCurrency(PoolKey calldata key, Currency currency) internal pure {
        if (
            Currency.unwrap(currency) != Currency.unwrap(key.currency0) &&
            Currency.unwrap(currency) != Currency.unwrap(key.currency1)
        ) revert InvalidCurrency();
    }

    function _roundTickDown(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 rounded = (tick / tickSpacing) * tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) rounded -= tickSpacing;
        return rounded;
    }

    function _transferOut(Currency currency, address to, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(Currency.unwrap(currency)).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
