import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  //  Deploy YourContract
  console.log("\n1. Deploying YourContract...");
  const YourContract = await ethers.getContractFactory("YourContract");
  const yourContract = await YourContract.deploy(deployer.address);
  await yourContract.waitForDeployment();
  const yourContractAddress = await yourContract.getAddress();
  console.log("YourContract deployed to:", yourContractAddress);


  // Verify the deployment
  console.log("\n7. Verifying deployment...");
  const deployedCode = await ethers.provider.getCode(yourContractAddress);
  if (deployedCode !== "0x") {
    console.log("✓ Contract deployed and verified!");
  } else {
    console.log("✗ Deployment verification failed");
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log("YourContract Address:", yourContractAddress);
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
