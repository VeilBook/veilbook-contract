// import { DeployFunction } from "hardhat-deploy/types";
// import { HardhatRuntimeEnvironment } from "hardhat/types";

// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   console.log("\n=== Deploying Base Dependencies ===\n");

//   // Deploy USP token
//   const usdc = await deploy("MockERC20_USDC", {
//     contract: "MockERC20",
//     from: deployer,
//     args: ["USD Coin", "USDC", 6],
//     log: true,
//   });
//   console.log(`USDC deployed at: ${usdc.address}`);

//   // Deploy 
//   const weth = await deploy("MockERC20_WETH", {
//     contract: "MockERC20",
//     from: deployer,
//     args: ["Wrapped Ether", "WETH", 18],
//     log: true,
//   });
//   console.log(`WETH deployed at: ${weth.address}`);

  
// };

// export default func;
// func.id = "deploy_dependencies";
// func.tags = ["dependencies", "MockERC20", "SimpleLending"];
