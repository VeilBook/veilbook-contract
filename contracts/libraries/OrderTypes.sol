// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {euint64} from "@fhevm/solidity/lib/FHE.sol";

library OrderTypes {

    /**
     * @notice A confidential limit order
     *
     * Example:
     *   Seller (zeroForOne=false): deposits 1 ETH (currency0)
     *     amountIn  = 1 ETH    (encrypted — what they locked)
     *     amountOut = computed from tick price (encrypted — what they expect back)
     *
     *   Buyer (zeroForOne=true): deposits 2000 USDC (currency1)
     *     amountIn  = 2000 USDC (encrypted — what they locked)
     *     amountOut = computed from tick price (encrypted — what they expect back)
     *
     * amountOut is computed on-chain in placeOrder() from TickMath.getSqrtPriceAtTick(tick)
     * User only needs to encrypt amountIn — contract derives amountOut deterministically.
     *
     * Decryption model (Zama fhEVM):
     *   Plaintext NEVER touches the contract during settlement.
     *   User decrypts filledOut client-side via Relayer + KMS → passes to claimFill().
     *   PoolEncryptedToken.burn() enforces balance on-chain.
     *
     * Why euint64:
     *   amountOut = amountIn * price
     *   e.g. 1e18 (1 ETH wei) * 2000 = 2e21 — overflows euint64 (max ~1.8e19)
     *   euint64 (max ~3.4e38) handles this comfortably.
     */
    struct LimitOrder {
        // -- public --
        address owner;
        int24 tick;
        bool zeroForOne;
        bool active;
        PoolKey poolKey;
        // -- encrypted (euint64) --
        euint64 amountIn;   // what they locked as collateral (deposit currency)
        euint64 amountOut;  // what they expect to receive (computed from tick price)
        euint64 filledIn;   // how much of amountIn has been matched so far
        euint64 filledOut;  // how much of amountOut has been received so far
    }

    /// @notice Emitted when a new limit order is placed
    event OrderPlaced(
        bytes32 indexed orderId,
        address indexed owner,
        PoolId indexed poolId,
        int24 tick,
        bool zeroForOne
    );

    /// @notice Emitted when two orders are (partially) matched at a tick
    /// @dev fillAmount is NOT emitted — encrypted, must stay private
    event OrdersMatched(
        bytes32 indexed buyOrderId,
        bytes32 indexed sellOrderId,
        int24 indexed tick
    );

    /// @notice Emitted when an order is marked inactive (cancelled or closed)
    event OrderClosed(
        bytes32 indexed orderId,
        address indexed owner
    );

    /// @notice Emitted when a user cancels their order and reclaims unfilled collateral
    event OrderCancelled(
        bytes32 indexed orderId,
        address indexed owner
    );

    /// @notice Emitted when a user claims their filled ERC20 proceeds
    /// @dev amount is NOT emitted — user decrypted it client-side, keep private
    event FillClaimed(
        bytes32 indexed orderId,
        address indexed owner
    );
}
