// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract DeterministicDeployFactory {
    event Deploy(address addr);


    function deploy(bytes memory bytecode, uint256 _salt) external payable returns (address) {
        address addr;
        assembly {
            // CREATE2(value, offset, size, salt)
            addr := create2(
                callvalue(), // Forward any ETH sent
                add(bytecode, 0x20), // Skip 32-byte length prefix
                mload(bytecode), // Load bytecode length
                _salt // Salt for deterministic address
            )

            // Verify deployment succeeded by checking code size
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        emit Deploy(addr);
        return addr;
    }

    function computeAddress(bytes memory bytecode, uint256 _salt) external view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), // CREATE2 prefix
                address(this), // Factory address
                bytes32(_salt), // Salt
                keccak256(bytecode) // Hash of initialization code
            )
        );
        return address(uint160(uint256(hash)));
    }
}
