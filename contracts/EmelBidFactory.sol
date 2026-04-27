// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.27;

// import {EmelBid} from "./EmelBid.sol";
// import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

// contract EmelBidFactory {
//     address public hook;

//     function deploy(address poolManager, bytes32 salt) external {
//         hook = address(new EmelBid{salt: salt}(IPoolManager(poolManager)));
//     }

//     function getPrecomputedHookAddress(
//         address poolManager,
//         bytes32 salt
//     ) external view returns (address) {
//         bytes32 bytecodeHash = keccak256(
//             abi.encodePacked(
//                 type(EmelBid).creationCode,
//                 abi.encode(poolManager)
//             )
//         );
//         bytes32 hash = keccak256(
//             abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)
//         );
//         return address(uint160(uint256(hash)));
//     }
// }