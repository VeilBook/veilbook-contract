import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying StateView ===\n");

  const poolManagerAddress = "0x1F6531C33e88d7eA0DfF8eAB7cBDbB19d64C6e20";
  const stateView = await deploy("StateView", {
    contract: "StateView",
    from: deployer,
    args: [poolManagerAddress], 
    log: true,
  });
  console.log(`StateView deployed at: ${stateView.address}`);
};

export default func;
func.id = "deploy_StateView";
func.tags = ["StateView"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags StateView --network sepolia
// deployed on sepolia network
// StateView deployed at: 0xE8571687a980f6a015BF0702A5eC88BFEd1E0cd6
