import { ethers } from "hardhat";
async function main() {

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const stateViewFactory = await ethers.getContractFactory("stateView");
    const stateViewFactoryContract = await stateViewFactory.deploy();
    await stateViewFactoryContract.waitForDeployment();
    const stateViewContractAddress = await stateViewFactoryContract.getAddress();
    console.log("StateView contract address:", stateViewContractAddress);

}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
