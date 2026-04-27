// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {FHE, externalEuint32, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";




contract PersonRegistry is ZamaEthereumConfig {

    uint256 public requestId;
    
    event DecryptionRequested(uint256 requestId, euint32 age, euint32 height);
    event DecryptionFulfilled(uint256 requestId, uint32 decryptedAge, uint32 decryptedHeight);

    struct DecryptionRequest {
        euint32 age;
        euint32 height;
        address user;
    }

    mapping(uint256 => DecryptionRequest) private requests;

    struct Person {
        euint32 age;
        euint32 height;
        uint32 ageClear;
        uint32 heightClear;

    }

    mapping(address => Person) private persons;
    

    function setPerson(
        externalEuint32 _age,
        externalEuint32 _height,
        bytes calldata inputProof
    ) external {
        // Convert external inputs → encrypted handles
        euint32 age = FHE.fromExternal(_age, inputProof);
        euint32 height = FHE.fromExternal(_height, inputProof);

        // Store
        persons[msg.sender] = Person(age, height, 0, 0);

        // Allow contract to reuse later
        FHE.allow(age, address(this));
        FHE.allow(height, address(this));

        // Allow user to decrypt
        FHE.allow(age, msg.sender);
        FHE.allow(height, msg.sender);

        emit DecryptionRequested(requestId, age, height);
        requests[requestId] = DecryptionRequest(age, height, msg.sender);
        requestId++;
    }

    function fulfillDecryption(uint256 _requestId, uint32 decryptedAge, uint32 decryptedHeight) external {
        address user = requests[_requestId].user;
        Person storage p = persons[user];
        p.ageClear = decryptedAge;
        p.heightClear = decryptedHeight;

        emit DecryptionFulfilled(_requestId, decryptedAge, decryptedHeight);

    }

    function getPerson(address user) external view returns (euint32, euint32, uint32, uint32) {
        Person storage p = persons[user];
        return (p.age, p.height, p.ageClear, p.heightClear);
    } 

    function getPersonByRequestId(uint256 _requestId) external view returns (address) {
        return requests[_requestId].user;
    }  
    
}
