// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {YourContract} from "../contracts/YourContract.sol";
import {console} from "forge-std/Console.sol";

contract YourContractTest is Test {
    YourContract public yourContract;

    function setUp() public {
        console.log("============================================================");
        console.log("=== Deploying YourContract ===");
        yourContract = new YourContract(vm.addr(1));
        
        console.log("\nYourContract deployed to:", address(yourContract));

        console.log("\n=== YourContract Deployed Successfully! ===");
        console.log("============================================================");
    }

    function testMessageOnDeployment() public view {
        require(keccak256(bytes(yourContract.greeting())) == keccak256("Building Unstoppable Apps!!!"));
    }
}
