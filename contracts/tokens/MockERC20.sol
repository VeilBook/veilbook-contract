// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Simple ERC20 with 6 decimals for VeilBook testing
 *
 * @dev Why 6 decimals?
 *   euint64 max = ~1.8e19
 *   With 18 decimals: 1 token = 1e18 — only fits ~18 tokens before overflow
 *   With 6 decimals:  1 token = 1e6  — fits up to ~1.8e13 tokens (18 trillion)
 *   Perfect for USDC-style tokens in FHE limit order testing.
 *
 * Example amounts:
 *   1 USDC    = 1_000_000      (1e6)
 *   2000 USDC = 2_000_000_000  (2e9)  ← fits comfortably in euint64
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
