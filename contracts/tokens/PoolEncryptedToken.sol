// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC7984} from "openzeppelin-confidential-contracts/contracts/token/ERC7984/ERC7984.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract PoolEncryptedToken is ZamaEthereumConfig, ERC7984, Ownable2Step {

    address public immutable underlyingToken;
    bytes32 public immutable poolId;
    address public hook;

    event HookUpdated(address indexed oldHook, address indexed newHook);
    error OnlyHook();
    error InvalidHook();
    error ZeroAddress();


    modifier onlyHook() {
        if (msg.sender != hook) revert OnlyHook();
        _;
    }

    constructor(
        address _underlyingToken,
        bytes32 _poolId,
        address _hook,
        string memory _name,
        string memory _symbol,
        string memory _tokenURI
    ) ERC7984(_name, _symbol, _tokenURI) Ownable(msg.sender) {
        // Note: _underlyingToken == address(0) is valid for ETH pools
        if (_hook == address(0)) revert InvalidHook();

        underlyingToken = _underlyingToken;
        poolId = _poolId;
        hook = _hook;
    }

 
    function mint(address to, euint64 amount) external onlyHook returns (euint64) {
        return _mint(to, amount);
    }

    function burn(address from, euint64 amount) external onlyHook returns (euint64) {
        return _burn(from, amount);
    }


    function hookTransfer(
        address from,
        address to,
        euint64 amount
    ) external onlyHook returns (euint64) {
        return _transfer(from, to, amount);
    }

 
    function updateHook(address newHook) external onlyOwner {
        if (newHook == address(0)) revert InvalidHook();
        address oldHook = hook;
        hook = newHook;
        emit HookUpdated(oldHook, newHook);
    }


    function getTokenInfo() external view returns (
        address _underlying,
        bytes32 _poolId,
        address _hook
    ) {
        return (underlyingToken, poolId, hook);
    }
}
