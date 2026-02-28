import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import _deployments_ from "../deploy/deployments";
import { getContracts } from "../util/contracts";


task("pool", "Creates pool")
  .setAction(async (_, hre: HardhatRuntimeEnvironment) => {

    const { ethers, deployments } = hre;

    console.log("=== Get pool state ===");


    const poolKey = {
        currency0: _deployments_.ETH_ADDRESS,
        currency1: _deployments_.USDC_ADDRESS,
        fee: 3000,         // 0.3%
        tickSpacing: 60,   // Standard spacing for 0.3% pools
        hooks: _deployments_.ADDRESS_ZERO,
    };
    
    const encodedPoolKey = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint24", "int24", "address"],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );

    // 4. Hash to get the PoolId
    const poolId = ethers.keccak256(encodedPoolKey);

    console.log("PoolId:", poolId);
    const { stateViewContract } = getContracts(ethers.provider);
    
    const [slot0, liquidity] = await Promise.all([
        stateViewContract.getSlot0(poolId, {
          blockTag: "latest",
        }),
        stateViewContract.getLiquidity(poolId, {
          blockTag: "latest",
        }),
      ])
      console.log({slot0, liquidity})


  });

