// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/Console.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {PositionInfo, PositionInfoLibrary} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {FixedPoint128} from "@uniswap/v4-core/src/libraries/FixedPoint128.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


import { UniversalRouter } from "@uniswap/universal-router/contracts/UniversalRouter.sol";
import { Commands } from "@uniswap/universal-router/contracts/libraries/Commands.sol";
import { IV4Router } from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import { IV4Quoter } from "@uniswap/v4-periphery/src/interfaces/IV4Quoter.sol";
import { IPermit2 } from "permit2/src/interfaces/IPermit2.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {BaseTest} from "./utils/BaseTest.sol";

// using universal router
// we need permit2, poolManager and router deployed

contract Swap is BaseTest {

    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;


    PoolKey poolKey;
    Currency currency0;
    Currency currency1;


    function setUp() public {
        console.log("============================================================");
        deployArtifactsAndLabel();


        (currency0, currency1) = deployCurrencyPair(vm.addr(1));
        
        console.log("=== Initialize pool ===");

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        console.log("=== Get pool info ===");
        (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = poolManager.getSlot0(poolKey.toId());
        console.log("sqrtPriceX96: ", sqrtPriceX96);
        console.log("tick: ", tick);
        console.log("protocolFee: ", protocolFee);
        console.log("lpFee: ", lpFee);


        console.log("=== Add liquidity ===");

        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP));
        bytes[] memory params = new bytes[](3);
    
        uint128 liquidityAmount = 100e18;
        // int24 tickLower = -180;
        // int24 tickUpper = 180;
        int24 tickLower = TickMath.minUsableTick(60);  // ~-887220
        int24 tickUpper = TickMath.maxUsableTick(60);  // ~887220     

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );
        

        params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidityAmount, amount0Expected + 1, amount1Expected + 1, address(this), Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1);
        params[2] = abi.encode(CurrencyLibrary.ADDRESS_ZERO, address(this));

        uint256 deadline = block.timestamp + 60;
        uint256 valueToPass = currency0.isAddressZero() ? (amount0Expected + 1) : 0;
        positionManager.modifyLiquidities{value: valueToPass}(abi.encode(actions, params), deadline);
        


        console.log("============================================================");
    }




//   struct ExactInputSingleParams {
//         PoolKey poolKey;
//         bool zeroForOne;
//         uint128 amountIn;
//         uint128 amountOutMinimum;
//         bytes hookData;
//     }
    function testswapExactInputSingle() public {
        console.log("============================================================");

        uint128 liquidity = poolManager.getLiquidity(poolKey.toId());
        console.log("liquidity", liquidity);


        console.log("=== Get pool info (liquidity and token reserves) ......important, yet to find how to get pool reserves...... ===");


        bytes memory commands = abi.encodePacked(uint8(Commands.V4_SWAP));
        // Encode V4Router actions
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE_ALL),
            uint8(Actions.TAKE_ALL)
        );

        bytes[] memory params = new bytes[](3);
        uint128 amountIn = 2e18;

        console.log("=== Get minAmountOut from quoter ===");
  
        (uint256 minAmountOut, uint256 gasEstimate) = quoter.quoteExactInputSingle
        (IV4Quoter.QuoteExactSingleParams({
            poolKey: poolKey,
            zeroForOne: true,
            exactAmount: amountIn,
            hookData: bytes("")  
        }));
        console.log("Quote amountOut: ", minAmountOut);
        console.log("Quote gasEstimate: ", gasEstimate);


        // uint128 minAmountOut = 0;

        // First parameter: swap configuration
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: true,           
                amountIn: amountIn,          
                amountOutMinimum: uint128(minAmountOut),
                hookData: bytes("")            
            })
        );

        params[1] = abi.encode(poolKey.currency0, amountIn);
        params[2] = abi.encode(poolKey.currency1, minAmountOut);

        bytes[] memory inputs = new bytes[](1);

        // Combine actions and params into inputs
        inputs[0] = abi.encode(actions, params);

        
        console.log("=== Approve tokens with permit2 ===");
        uint48 expiration = uint48(block.timestamp + 30 minutes); // 1800 seconds
        // uint48 expiration = uint48(block.timestamp + 1 days); // 86400 seconds
        approveTokenWithPermit2(Currency.unwrap(poolKey.currency0), amountIn, expiration);
        
        console.log("=== Execute the swap ===");
        uint256 token1Before = poolKey.currency1.balanceOf(address(this));

        uint256 deadline = block.timestamp + 20;
        router.execute(commands, inputs, deadline);

        uint256 token1After = poolKey.currency1.balanceOf(address(this));
        console.log("Amount out (token1After - token1Before): ", token1After - token1Before);
        // require(amountOut >= minAmountOut, "Insufficient output amount");


        console.log("============================================================");

    }

    function approveTokenWithPermit2(
        address token,
        uint160 amount,
        uint48 expiration
    ) internal {
        IERC20(token).approve(address(permit2), type(uint256).max);
        if (expiration == 0) {
            expiration = uint48(block.timestamp + 30 minutes);
        }
        permit2.approve(token, address(router), amount, expiration);
    }

}