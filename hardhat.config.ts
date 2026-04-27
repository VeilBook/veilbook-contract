import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import { configDotenv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";


configDotenv();

// Run 'npx hardhat vars setup' to see the list of variables that need to be set


const MNEMONIC: string = process.env.MNEMONIC || "test test test test test test test test test test test junk";
const INFURA_API_KEY: string = process.env.INFURA_API_KEY || "34c3a5f3ecf943498710543fe38b50f4";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 24236798,
      },
      // Add this to bypass the "gas too low" error locally:
      initialBaseFeePerGas: 0, 
      gasPrice: 0,
    },
    anvil: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/hardhat-template/issues/31
            bytecodeHash: "none",
          },
          // Disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
            runs: 1, // Minimize bytecode size for deployment
          },
          evmVersion: "cancun",
          viaIR: true, // Enable IR compilation to avoid stack too deep errors
        },
      },
      {
        version: "0.8.26",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 1, // Minimize bytecode size for deployment
          },
          evmVersion: "cancun",
          viaIR: true, // Enable IR compilation to avoid stack too deep errors
        },
      },
    ],
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
