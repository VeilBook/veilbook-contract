// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AuctionSlot is ERC20 {
    // Purely exists to generate a unique address per auction
    // No supply minted, no transfers needed
    // Only used as token1 in the Uniswap V4 pool to produce a unique PoolId
    constructor() ERC20("AuctionSlot", "AS") {}
}