import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying PersonRegistry ===\n");

 
  const PersonRegistry = await deploy("PersonRegistry", {
    contract: "PersonRegistry",
    from: deployer,
    args: [], 
    log: true,
  });
  console.log(`PersonRegistry deployed at: ${PersonRegistry.address}`);
};

export default func;
func.id = "deploy_PersonRegistry";
func.tags = ["PersonRegistry"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags PersonRegistry --network sepolia --reset
