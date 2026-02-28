// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/Console.sol";
import {YourContract} from "../contracts/YourContract.sol";


contract DeployYourContract is Script {

    address deployer = 0x026ba0AA63686278C3b3b3b9C43bEdD8421E36Cd;


    function run() external {
        console.log("============================================================");
        console.log("=== Deploying YourContract ===");
        console.log("\nDeployer:", deployer);
        YourContract deployedContract = new YourContract(deployer);

        console.log("\nYourContract deployed to:", address(deployedContract));
       
        console.log("\n=== YourContract Deployed Successfully! ===");
        console.log("============================================================");
    }
}
