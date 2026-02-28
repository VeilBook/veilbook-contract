// write simple deploy script for YourContract
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying YourContract ===\n");

 
  const yourContract = await deploy("YourContract", {
    contract: "contracts/YourContract.sol:YourContract",
    from: deployer,
    args: [deployer], // owner
    log: true,
  });
  console.log(`YourContract deployed at: ${yourContract.address}`);

  console.log("\n=== YourContract Deployed ===\n");
};

export default func;
func.id = "deploy_your_contract";
func.tags = ["YourContract"];
func.dependencies = ["dependencies"];