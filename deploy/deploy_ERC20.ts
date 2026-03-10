import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n=== Deploying Mock ERC20 Tokens ===\n");

  const tokens = [
    { id: "MockERC20_NBL", name: "Nebula",  symbol: "NBL" },
    { id: "MockERC20_SLR", name: "Solaris", symbol: "SLR" },
    { id: "MockERC20_ATH", name: "Aether",  symbol: "ATH" },
    { id: "MockERC20_VTX", name: "Vortex",  symbol: "VTX" },
    { id: "MockERC20_ZTA", name: "Zeta",  symbol: "ZTA" },
  ];

  for (const token of tokens) {
    const deployed = await deploy(token.id, {
      contract: "MockERC20",
      from: deployer,
      args: [token.name, token.symbol],
      log: true,
    });
    console.log(`${token.symbol} deployed at: ${deployed.address}`);
  }
};

export default func;
func.id = "deploy_mock_tokens";
func.tags = ["MockERC20", "tokens"];
func.dependencies = ["dependencies"];

// npx hardhat deploy --tags MockERC20 --network sepolia --reset
// deployed on sepolia network

// NBL deployed at: 0x5EDB776E0e8324609276De545118E5f4ef0e820B
// SLR deployed at: 0x2f1b32866FFF6c5c48324806A94a3766cF69861D
// ATH deployed at: 0x3dC4270317C33873538EfBE05F22711F33187FEa
// VTX deployed at: 0x3C8330c0A975b77bc9d809b75d32ACee49C64cc9
// ZTA deployed at: 0xBce34969854a0950788f248D18B997b8b05798F9