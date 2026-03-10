import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying PoolModifyLiquidityTest ===\n");

  const poolManagerAddress = "0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D";

  const PoolModifyLiquidityTest = await deploy("PoolModifyLiquidityTest", {
    contract: "PoolModifyLiquidityTest",
    from: deployer,
    args: [poolManagerAddress], // owner
    log: true,
  });
  console.log(`PoolModifyLiquidityTest deployed at: ${PoolModifyLiquidityTest.address}`);
};

export default func;
func.id = "deploy_PoolModifyLiquidityTest";
func.tags = ["PoolModifyLiquidityTest"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags PoolModifyLiquidityTest --network sepolia --reset
// deployed on sepolia network
// PoolModifyLiquidityTest deployed at: 0x03361fA440BACEDCd807B7D419AA83865Abed9ee
