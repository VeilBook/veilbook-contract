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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {FHE, externalEuint64, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {PoolEncryptedToken} from "./tokens/PoolEncryptedToken.sol";
import {OrderTypes} from "./libraries/OrderTypes.sol";
import {FHEPermissions} from "./libraries/FHEPermissions.sol";

contract ConfidentialLimitOrderHook is
    BaseHook,
    ReentrancyGuard,
    ZamaEthereumConfig,
    Ownable2Step
{
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;


    error NotOrderOwner();
    error OrderNotFound();
    error OrderNotActive();
    error InvalidAmount();
    error InvalidCurrency();
    error PoolNotInitialized();

   
    /**
     * @notice Order book: poolId => tick => zeroForOne => orderId[]
     *
     * zeroForOne = true  → buy orders  (locked currency1, want currency0)
     * zeroForOne = false → sell orders (locked currency0, want currency1)
     *
     * Matching: orderBook[id][tick][true] vs orderBook[id][tick][false]
     */
    mapping(PoolId => mapping(int24 => mapping(bool => bytes32[]))) public orderBook;

    /// @notice Order storage: orderId => LimitOrder
    mapping(bytes32 => OrderTypes.LimitOrder) public orders;

    /// @notice All order IDs per user (for client-side enumeration)
    mapping(address => bytes32[]) public userOrders;

    /// @notice Encrypted tokens per pool and currency: poolId => currency => PoolEncryptedToken
    mapping(PoolId => mapping(Currency => PoolEncryptedToken)) public poolEncryptedTokens;

    /// @notice Last known tick per pool — used in afterSwap to detect crossing range
    mapping(PoolId => int24) public lastTick;

    /// @notice Order ID counter
    uint256 private _orderCounter;

    /// @notice Maximum orders processed per tick per swap (gas safety bound)
    uint256 public constant MAX_ORDERS_PER_SETTLE = 5;

 
    constructor(IPoolManager _poolManager)
        BaseHook(_poolManager)
        Ownable(msg.sender)
    {}

    

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

    /**
     * @notice After every swap, detect crossed ticks and settle orders there
     * @dev Bounds loop to MAX_ORDERS_PER_SETTLE per tick to prevent OOG
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        (, int24 currentTick,,) = poolManager.getSlot0(poolId);
        int24 prevTick = lastTick[poolId];
        lastTick[poolId] = currentTick;

        if (currentTick == prevTick) return (BaseHook.afterSwap.selector, 0);

        int24 spacing  = key.tickSpacing;
        int24 tickLower = _roundTickDown(
            currentTick < prevTick ? currentTick : prevTick,
            spacing
        );
        int24 tickUpper = _roundTickDown(
            currentTick < prevTick ? prevTick : currentTick,
            spacing
        );

        for (int24 tick = tickLower; tick <= tickUpper; tick += spacing) {
            _settleAtTick(poolId, key, tick);
        }

        return (BaseHook.afterSwap.selector, 0);
    }


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

        // Wrap plaintext amount into encrypted handle and mint to user
        euint64 encAmount = FHE.asEuint64(uint64(amount));
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);        // user can decrypt their own balance
        FHE.allow(encAmount, address(encToken)); // token contract can operate on it

        encToken.mint(msg.sender, encAmount);
    }


    function placeOrder(
        PoolKey calldata key,
        int24 tick,
        bool zeroForOne,
        externalEuint64 encAmountIn,
        bytes calldata amountInProof,
        externalEuint64 encAmountOut,
        bytes calldata amountOutProof
    ) external nonReentrant returns (bytes32 orderId) {
        int24 usableTick = _roundTickDown(tick, key.tickSpacing);
        PoolId poolId = key.toId();

        // Convert encrypted inputs to internal handles
        euint64 amountIn  = FHE.fromExternal(encAmountIn,  amountInProof);
        euint64 amountOut = FHE.fromExternal(encAmountOut, amountOutProof);

        // Buyer  (zeroForOne=true)  locked currency1 — wants currency0
        // Seller (zeroForOne=false) locked currency0 — wants currency1
        Currency depositCurrency = zeroForOne ? key.currency1 : key.currency0;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][depositCurrency];
        if (address(encToken) == address(0)) revert PoolNotInitialized();

        // Grant FHE permissions
        FHEPermissions.grantPlaceOrderPermissions(amountIn, amountOut, msg.sender, address(encToken));

        // Initialize fill counters at 0
        euint64 filledIn  = FHE.asEuint64(0);
        euint64 filledOut = FHE.asEuint64(0);
        FHEPermissions.grantFilledPermissions(filledIn, filledOut, msg.sender);

        // Pull encrypted collateral — user must have called setOperator(hook, until) frontend-side
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


    function cancelOrder(
        bytes32 orderId,
        uint64 plaintextUnfilled
    ) external nonReentrant {
        OrderTypes.LimitOrder storage order = orders[orderId];
        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert NotOrderOwner();
        if (!order.active)             revert OrderNotActive();

        // Effects before interactions (re-entrancy safety)
        order.active = false;

        PoolKey memory key = order.poolKey;
        PoolId poolId = key.toId();

        // Refund deposit currency (what they originally locked)
        Currency depositCurrency = order.zeroForOne ? key.currency1 : key.currency0;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][depositCurrency];

        // Re-encrypt and burn unfilled collateral
        euint64 encUnfilled = FHE.asEuint64(plaintextUnfilled);
        FHEPermissions.grantCancelPermissions(encUnfilled, msg.sender, address(encToken));
        encToken.burn(msg.sender, encUnfilled);

        // Refund ERC20 or ETH
        _transferOut(depositCurrency, msg.sender, plaintextUnfilled);

        emit OrderTypes.OrderCancelled(orderId, msg.sender);
        emit OrderTypes.OrderClosed(orderId, msg.sender);
    }


    function claimFill(
        bytes32 orderId,
        uint64 plaintextFilled
    ) external nonReentrant {
        OrderTypes.LimitOrder storage order = orders[orderId];
        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert NotOrderOwner();
        if (plaintextFilled == 0)      revert InvalidAmount();

        PoolKey memory key = order.poolKey;
        PoolId poolId = key.toId();

        // Outgoing currency = what the counterparty deposited
        // Buyer  (zeroForOne=true)  deposited currency1, receives currency0
        // Seller (zeroForOne=false) deposited currency0, receives currency1
        Currency outCurrency = order.zeroForOne ? key.currency0 : key.currency1;
        PoolEncryptedToken encToken = poolEncryptedTokens[poolId][outCurrency];

        // Re-encrypt claimed amount, burn, send ERC20
        euint64 encClaimed = FHE.asEuint64(plaintextFilled);
        FHEPermissions.grantClaimPermissions(encClaimed, msg.sender, address(encToken));
        encToken.burn(msg.sender, encClaimed);

        _transferOut(outCurrency, msg.sender, plaintextFilled);

        emit OrderTypes.FillClaimed(orderId, msg.sender);
    }


    function _settleAtTick(
        PoolId poolId,
        PoolKey calldata key,
        int24 tick
    ) internal {
        bytes32[] storage buyOrders  = orderBook[poolId][tick][true];
        bytes32[] storage sellOrders = orderBook[poolId][tick][false];

        if (buyOrders.length == 0 || sellOrders.length == 0) return;

        PoolEncryptedToken encToken0 = poolEncryptedTokens[poolId][key.currency0];
        PoolEncryptedToken encToken1 = poolEncryptedTokens[poolId][key.currency1];

        uint256 bi = 0;
        uint256 si = 0;
        uint256 iterations = 0;

        while (bi < buyOrders.length && si < sellOrders.length && iterations < MAX_ORDERS_PER_SETTLE) {
            OrderTypes.LimitOrder storage buy  = orders[buyOrders[bi]];
            OrderTypes.LimitOrder storage sell = orders[sellOrders[si]];

            if (!buy.active)  { bi++; continue; }
            if (!sell.active) { si++; continue; }

            // ── Compute remaining on each side ───────────────────────────────
            // Seller remaining: how much currency0 they still have to give
            euint64 sellRemainingIn  = FHE.sub(sell.amountIn,  sell.filledIn);
            // Buyer remaining: how much currency0 they still want to receive
            euint64 buyRemainingOut  = FHE.sub(buy.amountOut,  buy.filledOut);

            // Buyer remaining: how much currency1 they still have to give
            euint64 buyRemainingIn   = FHE.sub(buy.amountIn,   buy.filledIn);
            // Seller remaining: how much currency1 they still want to receive
            euint64 sellRemainingOut = FHE.sub(sell.amountOut, sell.filledOut);

            // ── Fill amounts (same-unit comparisons) ─────────────────────────
            // fillIn  = how much currency0 moves  (seller → buyer)
            euint64 fillIn  = FHE.min(sellRemainingIn,  buyRemainingOut);
            // fillOut = how much currency1 moves  (buyer → seller)
            euint64 fillOut = FHE.min(buyRemainingIn,   sellRemainingOut);

            // ── Update fill counters ─────────────────────────────────────────
            euint64 newSellFilledIn  = FHE.add(sell.filledIn,  fillIn);
            euint64 newSellFilledOut = FHE.add(sell.filledOut, fillOut);
            euint64 newBuyFilledIn   = FHE.add(buy.filledIn,   fillOut); // buyer gave fillOut of currency1
            euint64 newBuyFilledOut  = FHE.add(buy.filledOut,  fillIn);  // buyer received fillIn of currency0

            // Grant ACL for all new handles
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

            // Persist
            sell.filledIn  = newSellFilledIn;
            sell.filledOut = newSellFilledOut;
            buy.filledIn   = newBuyFilledIn;
            buy.filledOut  = newBuyFilledOut;

            // ── Token transfers ──────────────────────────────────────────────
            // Hook holds currency0 encToken (locked by seller) → send to buyer
            encToken0.hookTransfer(address(this), buy.owner,  fillIn);
            // Hook holds currency1 encToken (locked by buyer)  → send to seller
            encToken1.hookTransfer(address(this), sell.owner, fillOut);

            emit OrderTypes.OrdersMatched(buyOrders[bi], sellOrders[si], tick);

            bi++;
            si++;
            iterations++;
        }
    }


    function getUserOrders(address user) external view returns (bytes32[] memory) {
        return userOrders[user];
    }

    function getOrder(bytes32 orderId) external view returns (
        address owner,
        int24 tick,
        bool zeroForOne,
        bool active,
        euint64 amountIn,   // handle — decrypt client-side
        euint64 amountOut,  // handle — decrypt client-side
        euint64 filledIn,   // handle — decrypt client-side
        euint64 filledOut   // handle — decrypt client-side
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
