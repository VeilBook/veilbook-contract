import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying PoolManager ===\n");

 
  const poolManager = await deploy("PoolManager", {
    contract: "PoolManager",
    from: deployer,
    args: [deployer], // owner
    log: true,
  });
  console.log(`PoolManager deployed at: ${poolManager.address}`);
};

export default func;
func.id = "deploy_poolManager";
func.tags = ["PoolManager"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags PoolManager --network sepolia
// deployed on sepolia network
// PoolManager deployed at: 0x1F6531C33e88d7eA0DfF8eAB7cBDbB19d64C6e20 