// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

library FHEPermissions {

    /**
     * @notice Grant permissions after placeOrder() converts inputs → euint64 handles
     * @dev amountOut is computed on-chain from tick price, not supplied by user
     * @param amountIn   encrypted deposit amount
     * @param amountOut  encrypted expected output (computed from tick price)
     * @param owner      order owner
     * @param encToken   PoolEncryptedToken for the deposit currency
     */
    function grantPlaceOrderPermissions(
        euint64 amountIn,
        euint64 amountOut,
        address owner,
        address encToken
    ) internal {
        // amountIn — hook for FHE ops, owner to decrypt, token for transfer
        FHE.allowThis(amountIn);
        FHE.allow(amountIn, owner);
        FHE.allow(amountIn, encToken);

        // amountOut — hook for FHE ops, owner to decrypt expected output
        FHE.allowThis(amountOut);
        FHE.allow(amountOut, owner);
    }

    /**
     * @notice Grant permissions for filledIn and filledOut initialized at 0
     * @param filledIn   encrypted filledIn counter (starts at 0)
     * @param filledOut  encrypted filledOut counter (starts at 0)
     * @param owner      order owner — needs access to track progress client-side
     */
    function grantFilledPermissions(
        euint64 filledIn,
        euint64 filledOut,
        address owner
    ) internal {
        FHE.allowThis(filledIn);
        FHE.allow(filledIn, owner);

        FHE.allowThis(filledOut);
        FHE.allow(filledOut, owner);
    }

    /**
     * @notice Grant permissions on all handles computed during _settleAtTick()
     * @dev Every FHE op produces a NEW handle — each needs its own allow() calls
     *
     * @param fillIn           currency0 fill (seller's input → buyer receives)
     * @param fillOut          currency1 fill (buyer's input → seller receives)
     * @param newBuyFilledIn   updated filledIn for buy order
     * @param newBuyFilledOut  updated filledOut for buy order
     * @param newSellFilledIn  updated filledIn for sell order
     * @param newSellFilledOut updated filledOut for sell order
     * @param buyOwner         owner of the buy order
     * @param sellOwner        owner of the sell order
     * @param encToken0        PoolEncryptedToken for currency0
     * @param encToken1        PoolEncryptedToken for currency1
     */
    function grantSettlementPermissions(
        euint64 fillIn,
        euint64 fillOut,
        euint64 newBuyFilledIn,
        euint64 newBuyFilledOut,
        euint64 newSellFilledIn,
        euint64 newSellFilledOut,
        address buyOwner,
        address sellOwner,
        address encToken0,
        address encToken1
    ) internal {
        // fillIn — currency0 moving hook → buyer
        FHE.allowThis(fillIn);
        FHE.allow(fillIn, encToken0);
        FHE.allow(fillIn, buyOwner);   // buyer can decrypt what they received
        FHE.allow(fillIn, sellOwner);  // seller can verify what was taken from them

        // fillOut — currency1 moving hook → seller
        FHE.allowThis(fillOut);
        FHE.allow(fillOut, encToken1);
        FHE.allow(fillOut, sellOwner); // seller can decrypt what they received
        FHE.allow(fillOut, buyOwner);  // buyer can verify what was taken from them

        // buy order updated counters
        FHE.allowThis(newBuyFilledIn);
        FHE.allow(newBuyFilledIn, buyOwner);
        FHE.allowThis(newBuyFilledOut);
        FHE.allow(newBuyFilledOut, buyOwner);

        // sell order updated counters
        FHE.allowThis(newSellFilledIn);
        FHE.allow(newSellFilledIn, sellOwner);
        FHE.allowThis(newSellFilledOut);
        FHE.allow(newSellFilledOut, sellOwner);
    }

    /**
     * @notice Grant permissions when re-encrypting claimed amount in claimFill()
     * @param encClaimed  re-encrypted claimed amount (user-supplied plaintext → euint64)
     * @param owner       the claimer
     * @param encToken    PoolEncryptedToken that will burn this amount
     */
    function grantClaimPermissions(
        euint64 encClaimed,
        address owner,
        address encToken
    ) internal {
        FHE.allowThis(encClaimed);
        FHE.allow(encClaimed, owner);
        FHE.allow(encClaimed, encToken);
    }

    /**
     * @notice Grant permissions when re-encrypting unfilled amount for cancelOrder()
     * @param unfilled   encrypted unfilled = amountIn - filledIn
     * @param owner      the canceller
     * @param encToken   PoolEncryptedToken that will burn the unfilled tokens
     */
    function grantCancelPermissions(
        euint64 unfilled,
        address owner,
        address encToken
    ) internal {
        FHE.allowThis(unfilled);
        FHE.allow(unfilled, owner);
        FHE.allow(unfilled, encToken);
    }
}
