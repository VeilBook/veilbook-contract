// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

library FHEPermissions {

    function grantPlaceOrderPermissions(
        euint64 amountIn,
        euint64 amountOut,
        address owner,
        address encToken
    ) internal {
        FHE.allowThis(amountIn);
        FHE.allow(amountIn, owner);
        FHE.allow(amountIn, encToken);

        FHE.allowThis(amountOut);
        FHE.allow(amountOut, owner);
    }


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
        FHE.allowThis(fillIn);
        FHE.allow(fillIn, encToken0);
        FHE.allow(fillIn, sellOwner);

        FHE.allowThis(fillOut);
        FHE.allow(fillOut, encToken1);
        FHE.allow(fillOut, buyOwner);

        FHE.allowThis(newBuyFilledIn);
        FHE.allow(newBuyFilledIn, buyOwner);
        FHE.allowThis(newBuyFilledOut);
        FHE.allow(newBuyFilledOut, buyOwner);

        FHE.allowThis(newSellFilledIn);
        FHE.allow(newSellFilledIn, sellOwner);
        FHE.allowThis(newSellFilledOut);
        FHE.allow(newSellFilledOut, sellOwner);
    }


    function grantClaimPermissions(
        euint64 encClaimed,
        address owner,
        address encToken
    ) internal {
        FHE.allowThis(encClaimed);
        FHE.allow(encClaimed, owner);
        FHE.allow(encClaimed, encToken);
    }


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
