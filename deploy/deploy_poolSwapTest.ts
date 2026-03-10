import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying PoolSwapTest ===\n");

  const poolManagerAddress = "0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D";

  const PoolSwapTest = await deploy("PoolSwapTest", {
    contract: "PoolSwapTest",
    from: deployer,
    args: [poolManagerAddress], // owner
    log: true,
  });
  console.log(`PoolSwapTest deployed at: ${PoolSwapTest.address}`);
};

export default func;
func.id = "deploy_PoolSwapTest";
func.tags = ["PoolSwapTest"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags PoolSwapTest --network sepolia --reset
// deployed on sepolia network
// PoolSwapTest deployed at: 0xEF02dEC3B6E81850974A39c7B18a9fB1BB5b1758
