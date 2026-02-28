// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {euint64} from "@fhevm/solidity/lib/FHE.sol";

library OrderTypes {


    struct LimitOrder {
        // -- public --
        address owner;
        int24 tick;
        bool zeroForOne;
        bool active;
        PoolKey poolKey;
        // -- encrypted --
        euint64 amountIn;   // what they locked as collateral (their deposit currency)
        euint64 amountOut;  // what they want to receive (the other currency)
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
