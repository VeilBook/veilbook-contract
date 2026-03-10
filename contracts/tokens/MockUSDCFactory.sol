// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {MockERC20} from "./MockERC20.sol";

contract MockUSDCFactory {
    event Deployed(address indexed token, bytes32 salt);

    function deploy(bytes32 salt) external returns (address) {
        MockERC20 token = new MockERC20{salt: salt}("USD Coin", "USDC");
        emit Deployed(address(token), salt);
        return address(token);
    }

    function computeAddress(bytes32 salt) external view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(abi.encodePacked(
                    type(MockERC20).creationCode,
                    abi.encode("USD Coin", "USDC")
                ))
            )
        );
        return address(uint160(uint256(hash)));
    }
}