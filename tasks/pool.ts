
import { task } from "hardhat/config";
import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from "hardhat/types";
import _deployments_ from "../deploy/deployments";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { LiquidityAmounts, getSqrtRatioAtTick, getTickAtSqrtRatio } from "../util/LiquidityAmounts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TickMath, FullMath} from "@uniswap/v3-sdk";
import { Contract, parseEther, parseUnits, formatUnits, solidityPacked, AbiCoder, ZeroAddress } from "ethers";
import JSBI from "jsbi";
import { getContracts } from "../util/contracts";
import { approveTokenWithPermit2, checkApprovals, getPositionInfo, getFunds } from "../util/helpers";



const abi = AbiCoder.defaultAbiCoder();

task("liquidity", "modify liquidities")
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

    const { stateViewContract } = getContracts(ethers.provider);
    const [slot0, liquidity] = await Promise.all([
        stateViewContract.getSlot0(poolId, {
          blockTag: "latest",
        }),
        stateViewContract.getLiquidity(poolId, {
          blockTag: "latest",
        }),
    ])
    console.log({slot0, liquidity, price: slot0[0]});

    console.log("=== Get random position info ===");
    const {positionLiquidity, owner} = await getPositionInfo(47, ethers.provider);
    // console.log({positionLiquidity, owner});


    console.log("=== Mint position and get position info ===");
    const signer = (await ethers.getSigners())[0];
    
    // const tokenId = await mintPosition(poolKey, signer, ethers.provider, hre);
    // console.log({tokenId})
    const tokenId = 133559;
    await increaseLiquidity(poolKey, signer, ethers.provider, hre, tokenId);

  });


  const mintPosition = async(poolKey: any, signer: HardhatEthersSigner, provider: HardhatEthersProvider, hre: HardhatRuntimeEnvironment) => {

    let tokenId;

    // should use actual price of eth/usdc from slot0, 
    // lets hardcode for now

    const tickSpacing = 60; // For a 0.3% fee pool

    const getClosestTick = (tick: any, spacing: any) => Math.round(tick / spacing) * spacing;

    const tickLower = getClosestTick(-196152, tickSpacing); // Results in -196140
    const tickUpper = getClosestTick(-194244, tickSpacing); // Results in -194220

 

    const sqrtPriceX96 = 4575172869933267616996182n // get real price
                         
    const currentTick = TickMath.getTickAtSqrtRatio(JSBI.BigInt(String(sqrtPriceX96)));


    const sqrtPriceAX96 = BigInt((TickMath.getSqrtRatioAtTick(tickLower)).toString());
    const sqrtPriceBX96 = BigInt((TickMath.getSqrtRatioAtTick(tickUpper)).toString());

    const amount0Desired = parseUnits("15", 18);

    // 2. Calculate Liquidity (L) ONLY from the ETH side
    // This tells us: "How much 'pool depth' can 15 ETH provide in this range?"
    const L = LiquidityAmounts.getLiquidityForAmount0(
        sqrtPriceX96, 
        sqrtPriceBX96, // Upper bound
        amount0Desired
    );

    // 3. Calculate Amount 1 (USDC) ONLY from that L
    // This tells us: "How much USDC is needed to match that pool depth?"
    const amount1Required = LiquidityAmounts.getAmount1ForLiquidity(
        sqrtPriceAX96, // Lower bound
        sqrtPriceX96, 
        L
    );

   console.log("ETH to deposit:", formatUnits(amount0Desired, 18));
   console.log("USDC to deposit:", formatUnits(amount1Required, 6));



    const amount0Max = amount0Desired + 1n; 
    const amount1Max = amount1Required + 1n;  
    console.log({

        currentTick, tickLower, tickUpper, sqrtPriceAX96, sqrtPriceBX96,
        amount0Max, amount1Max
    })

    // Transfer the funds ($50k)
   const amount = parseUnits("50000", 6);

   console.log("...................getFunds...................................")
   await getFunds(signer.address, String(amount), hre);
   //check usdc balance
   const { erc20Contract } = getContracts(signer);
   const myUSDCBalance = await erc20Contract.balanceOf(signer.address);
   const myETHBalance = await provider.getBalance(signer.address);

    console.log(`Success! My USDC balance: ${formatUnits(myUSDCBalance, 6)} USDC`);
    console.log(`Success! My ETH balance: ${formatUnits(myETHBalance, 18)} ETH`);

    // check approvals
    const {
       tokenToPermit2,          
       p2ToPosmAmount,         
       p2ToPosmExpiration     
   } = await checkApprovals(
       poolKey.currency1,
       _deployments_.PERMIT2_ADDRESS,
       _deployments_.POSITION_MANAGER_ADDRESS,
       signer.address,
       provider
   );
   console.log(
       {
           tokenToPermit2,          
           p2ToPosmAmount,         
           p2ToPosmExpiration    
       }
   )

   if(p2ToPosmAmount === BigInt(0)) {
        //call approve function
        console.log("Hello")

        await approveTokenWithPermit2(
            _deployments_.PERMIT2_ADDRESS,
            _deployments_.POSITION_MANAGER_ADDRESS,
            poolKey.currency1,
            amount1Max,
            signer
        );
   }



    const recipient = signer.address;
    console.log("Recipient: ", recipient);

    const actions = solidityPacked(
        ["uint8", "uint8", "uint8"],
        [_deployments_.ACTIONS.MINT_POSITION, _deployments_.ACTIONS.SETTLE_PAIR, _deployments_.ACTIONS.SWEEP]
    );
    // (poolKey, tickLower, tickUpper, liquidityAmount, amount0Initial, amount1Initial, address(this), Constants.ZERO_BYTES)
    const params = [
        abi.encode(
          [
            "tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)", 
            "int24", "int24", "uint256", "uint128", "uint128", "address", "bytes"
          ],
          [
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
            tickLower, tickUpper, L, amount0Max, amount1Max, recipient, "0x"
          ]
        ),
        abi.encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
        abi.encode(["address", "address"], [ZeroAddress, recipient])
    ];

    const unlockData = abi.encode(["bytes", "bytes[]"], [actions, params]);
    // Define the deadline (e.g., 20 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const POSITION_MANAGER_CONTRACT = new Contract(_deployments_.POSITION_MANAGER_ADDRESS, _deployments_.POSITION_MANAGER_ABI, signer);
    const POOL_MANAGER_CONTRACT = new Contract(_deployments_.POOL_MANAGER_ADDRESS, _deployments_.POOL_MANAGER_ABI, signer);

    

    const tx = await POSITION_MANAGER_CONTRACT.modifyLiquidities(unlockData, deadline, {
        value: amount0Max,
    });

    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.hash);


    // 2. Look for the Transfer event from the PositionManager contract
    const transferLog = receipt.logs.find((log: any) => 
        log.address.toLowerCase() === _deployments_.POSITION_MANAGER_ADDRESS.toLowerCase()
    );
    console.log({transferLog});

    if (transferLog) {
        const parsedLog = POSITION_MANAGER_CONTRACT.interface.parseLog(transferLog);
        if (parsedLog && parsedLog.name === "Transfer") {
            const tokenId_ = parsedLog.args.tokenId;
            console.log("Newly Minted Position ID (TokenID):", tokenId_.toString());
            tokenId = tokenId_.toString();
        }
    }



    receipt.logs.forEach((log: any) => {
        try {
            // Attempt to parse the log using the contract interface
            const parsedLog = POOL_MANAGER_CONTRACT.interface.parseLog(log);
            // console.log("parsedLog: ", parsedLog)
            
            if (parsedLog) {
                console.log(`Event Name: ${parsedLog.name}`);
                console.log("Parsed Arguments:", parsedLog.args);
                
                // Access specific values (e.g., if the event is 'ModifyLiquidity')
                console.log("Liquidity change:", parsedLog.args.liquidityDelta.toString());
            }
        } catch (error) {
            // This log might belong to a different contract (e.g., an ERC20 transfer)
            // parseLog throws an error if it doesn't recognize the event signature
        }
    });

    // After you have your L (Liquidity), calculate the expected amounts
    const [ amount0, amount1 ] = LiquidityAmounts.getAmountsForLiquidity(
        sqrtPriceX96, 
        sqrtPriceAX96, 
        sqrtPriceBX96, 
        L
    );

    console.log(`Actual tokens being moved: ${amount0} Token0, ${amount1} Token1`);
    return tokenId;
    
    
  }

  const increaseLiquidity = async(poolKey: any, signer: HardhatEthersSigner, provider: HardhatEthersProvider, hre: HardhatRuntimeEnvironment, tokenId: any) => {

    const tickSpacing = 60; // For a 0.3% fee pool

    const getClosestTick = (tick: any, spacing: any) => Math.round(tick / spacing) * spacing;

    const tickLower = getClosestTick(-196152, tickSpacing); // Results in -196140
    const tickUpper = getClosestTick(-194244, tickSpacing); // Results in -194220

 

    const sqrtPriceX96 = 4575172869933267616996182n // get real price
                         
    const currentTick = TickMath.getTickAtSqrtRatio(JSBI.BigInt(String(sqrtPriceX96)));


    const sqrtPriceAX96 = BigInt((TickMath.getSqrtRatioAtTick(tickLower)).toString());
    const sqrtPriceBX96 = BigInt((TickMath.getSqrtRatioAtTick(tickUpper)).toString());

    const amount0Desired = parseUnits("5", 18);

    // 2. Calculate Liquidity (L) ONLY from the ETH side
    // This tells us: "How much 'pool depth' can 5 ETH provide in this range?"
    const L = LiquidityAmounts.getLiquidityForAmount0(
        sqrtPriceX96, 
        sqrtPriceBX96, // Upper bound
        amount0Desired
    );

    // 3. Calculate Amount 1 (USDC) ONLY from that L
    // This tells us: "How much USDC is needed to match that pool depth?"
    const amount1Required = LiquidityAmounts.getAmount1ForLiquidity(
        sqrtPriceAX96, // Lower bound
        sqrtPriceX96, 
        L
    );

   console.log("ETH to deposit:", formatUnits(amount0Desired, 18));
   console.log("USDC to deposit:", formatUnits(amount1Required, 6));

   const amount0Max = amount0Desired + 1n; 
    const amount1Max = amount1Required + 1n;  
    console.log({

        currentTick, tickLower, tickUpper, sqrtPriceAX96, sqrtPriceBX96,
        amount0Max, amount1Max
    })

    // 3. Transfer the funds ($50k)
   const amount = parseUnits("50000", 6);

   console.log("...................getFunds...................................")
   await getFunds(signer.address, String(amount), hre);
   //check usdc balance
   const { erc20Contract } = getContracts(signer);
   const myUSDCBalance = await erc20Contract.balanceOf(signer.address);
   const myETHBalance = await provider.getBalance(signer.address);

    console.log(`Success! My USDC balance: ${formatUnits(myUSDCBalance, 6)} USDC`);
    console.log(`Success! My ETH balance: ${formatUnits(myETHBalance, 18)} ETH`);

    // check approvals
    const {
        tokenToPermit2,          
        p2ToPosmAmount,         
        p2ToPosmExpiration     
    } = await checkApprovals(
        poolKey.currency1,
        _deployments_.PERMIT2_ADDRESS,
        _deployments_.POSITION_MANAGER_ADDRESS,
        signer.address,
        provider
    );
    console.log(
        {
            tokenToPermit2,          
            p2ToPosmAmount,         
            p2ToPosmExpiration    
        }
    )
 
    if(p2ToPosmAmount === BigInt(0)) {
         //call approve function
         console.log("Hello")
 
         await approveTokenWithPermit2(
             _deployments_.PERMIT2_ADDRESS,
             _deployments_.POSITION_MANAGER_ADDRESS,
             poolKey.currency1,
             amount1Max,
             signer
         );
    }
    

    const recipient = signer.address;
    console.log("Recipient: ", recipient);

    const actions = solidityPacked(
        ["uint8", "uint8", "uint8"], 
        [_deployments_.ACTIONS.INCREASE_LIQUIDITY, _deployments_.ACTIONS.SETTLE_PAIR, _deployments_.ACTIONS.SWEEP]
    );

    const params = [
        abi.encode(
            ["uint256", "uint256", "uint128", "uint128", "bytes"],
           [tokenId, L, amount0Max, amount1Max, "0x"]
        ),
        abi.encode(["address", "address"], [poolKey.currency0, poolKey.currency1]),
        abi.encode(["address", "address"], [ZeroAddress, recipient])
    ];

    const unlockData = abi.encode(["bytes", "bytes[]"], [actions, params]);
    // Define the deadline (e.g., 20 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const POSITION_MANAGER_CONTRACT = new Contract(_deployments_.POSITION_MANAGER_ADDRESS, _deployments_.POSITION_MANAGER_ABI, signer);
    const POOL_MANAGER_CONTRACT = new Contract(_deployments_.POOL_MANAGER_ADDRESS, _deployments_.POOL_MANAGER_ABI, signer);

    

    const tx = await POSITION_MANAGER_CONTRACT.modifyLiquidities(unlockData, deadline, {
        value: amount0Max,
    });

    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.hash);
    
    

    
  }


console.log("=== Increase position and get position info ===");



const decodeEventLogs = async () => {

    // onst receipt = await tx.wait();
    // console.log("Transaction confirmed:", receipt.hash);

    // read event to see info...
    // console.log("modifyLiquidities logs: ", receipt?.logs);
    // const transferEvent = receipt?.logs.find(
    //     log => log.address.toLowerCase() === _deployments_.POSITION_MANAGER_ADDRESS.toLowerCase()
    // );

    // console.log("Number of logs found:", receipt.logs.length);
    // const abiCoder = new ethers.AbiCoder();

    // get event signature
    // const eventSignature = "IncreaseLiquidity(uint256,uint128,uint256,uint256)"


    // Decode indexed parameters
    // const decodedId = abiCoder.decode(["bytes32"], receipt.logs[1].topics[1])[0];
    // const decodedSender = abiCoder.decode(["address"], receipt.logs[1].topics[2])[0];

    // console.log(decodedId, decodedSender)


    // const decoded = abiCoder.decode(["int24", "int24", "int256", "bytes32"], receipt.logs[1].data);
    // console.log("decoded: ", decoded);


    // this.........................................
    // const iface = new ethers.Interface([
    //     "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)"
    // ]);

    // receipt.logs.forEach((log: any) => {
    //     try {

    //         // This one line decodes BOTH topics and data into a single object
    //         const parsedLog = iface.parseLog({
    //             topics: log.topics,
    //             data: log.data
    //         });
            
    //         console.log(parsedLog?.args.id);
    //         console.log(parsedLog?.args.liquidityDelta);
    //     } catch(error) {

    //     }

    // })
    
    // or.........................................

    // receipt.logs.forEach((log: any) => {
    //     try {
    //         // Attempt to parse the log using the contract interface
    //         const parsedLog = POOL_MANAGER_CONTRACT.interface.parseLog(log);
    //         console.log("parsedLog: ", parsedLog)
            
    //         if (parsedLog) {
    //             console.log(`Event Name: ${parsedLog.name}`);
    //             console.log("Parsed Arguments:", parsedLog.args);
                
    //             // Access specific values (e.g., if the event is 'ModifyLiquidity')
    //             console.log("Liquidity change:", parsedLog.args.liquidityDelta.toString());
    //         }
    //     } catch (error) {
    //         // This log might belong to a different contract (e.g., an ERC20 transfer)
    //         // parseLog throws an error if it doesn't recognize the event signature
    //     }
    // });
    

}

