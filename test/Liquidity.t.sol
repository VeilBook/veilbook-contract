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

import {BaseTest} from "./utils/BaseTest.sol";


contract Liquidity is BaseTest {
    // NB: Looks like the pool keeps 1 token each of token A and token B for some reasons
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;


    PoolKey poolKey;
    Currency currency0;
    Currency currency1;
    uint256 amount0Initial;
    uint256 amount1Initial;

    

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

         console.log("=== Read pool state ===");
         (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = poolManager.getSlot0(poolKey.toId());
         console.log("sqrtPriceX96: ", sqrtPriceX96);
         console.log("tick: ", tick);
         console.log("protocolFee: ", protocolFee);
         console.log("lpFee: ", lpFee);


        console.log("=== Add liquidity ===");

        // prepare unlockData(actions and params)
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP));
        bytes[] memory params = new bytes[](3);
        // lets assume for sqrtPrice of 1:1, liqudity = 100 ether, tickLower = -180, tickUpper = 180,
        // calculate amount0Expected and amount1Expected from liquidity 
        // amount0Max = amount0Expected + 1
        // amount1Max = amount1Expected + 1
        uint128 liquidityAmount = 100e18;
        int24 tickLower = -180;
        int24 tickUpper = 180;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );
        amount0Initial = amount0Expected + 1;
        amount1Initial = amount1Expected + 1;
        

        params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidityAmount, amount0Initial, amount1Initial, address(this), Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1);
        params[2] = abi.encode(CurrencyLibrary.ADDRESS_ZERO, address(this));

        uint256 deadline = block.timestamp + 60;
        uint256 valueToPass = currency0.isAddressZero() ? (amount0Expected + 1) : 0;
        positionManager.modifyLiquidities{value: valueToPass}(abi.encode(actions, params), deadline);

        
        console.log("=== Get position info ===");
        uint128 liquidity = positionManager.getPositionLiquidity(1);
        PositionInfo info = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96_,,,) = poolManager.getSlot0(poolKey.toId());


        (uint256 amount0ForPosition, uint256 amount1ForPosition) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96_,
            TickMath.getSqrtPriceAtTick(info.tickLower()),
            TickMath.getSqrtPriceAtTick(info.tickUpper()),
            liquidity
        );

        console.log("Position liquidity: ", liquidity);
        assertEq(amount0Initial, amount0ForPosition + 1);
        assertEq(amount1Initial, amount1ForPosition + 1);
        console.log("Amount0 initial: ", amount0Initial);
        console.log("Amount1 initial: ", amount1Initial);
        console.log("Tick Lower: ", info.tickLower());
        console.log("Tick Upper: ", info.tickUpper());


        console.log("=== Get token reserve ===");
        uint256 reserve0 = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(poolManager));
        uint256 reserve1 = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(poolManager)); 

        console.log("Reserve0: ", reserve0);
        console.log("Reserve1: ", reserve1);
       



        console.log("============================================================");

    }

    function testIncreaseLiquidity() public {
        console.log("============================================================");

        console.log("=== Get position info ===");
        (PositionInfo info) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());


        console.log("=== Increase liquidity ===");

        bytes memory actions = abi.encodePacked(uint8(Actions.INCREASE_LIQUIDITY), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP));
        uint128 liquidityAmount = 15e18;


        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(info.tickLower()),
            TickMath.getSqrtPriceAtTick(info.tickUpper()),
            liquidityAmount
        );
        console.log("Increase liquidity: sqrtPriceX96: ", sqrtPriceX96);
        console.log("Increase liquidity: info.tickLower(): ", info.tickLower());
        console.log("Increase liquidity: info.tickUpper(): ", info.tickUpper());

        console.log("Increase liquidity: amount0Expected: ", amount0Expected);
        console.log("Increase liquidity: amount1Expected: ", amount1Expected);

        bytes[] memory params = new bytes[](3);
        uint256 tokenId = 1;
        params[0] = abi.encode(tokenId, liquidityAmount, amount0Expected + 1, amount1Expected + 1, Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1);
        params[2] = abi.encode(CurrencyLibrary.ADDRESS_ZERO, address(this));

        uint256 deadline = block.timestamp + 60;

        uint256 valueToPass = currency0.isAddressZero() ? (amount0Expected + 1) : 0;

        positionManager.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            deadline
        );

        console.log("=== Get position info ===");
        uint128 liquidity_ = positionManager.getPositionLiquidity(1);
        (PositionInfo info_) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96_,,,) = poolManager.getSlot0(poolKey.toId());

        (uint256 amount0ForPosition, uint256 amount1ForPosition) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96_,
            TickMath.getSqrtPriceAtTick(info_.tickLower()),
            TickMath.getSqrtPriceAtTick(info_.tickUpper()),
            liquidity_
        );

        console.log("Position liquidity: ", liquidity_);
        assertEq(amount0Initial + amount0Expected + 1, amount0ForPosition + 1);
        assertEq(amount1Initial + amount1Expected + 1, amount1ForPosition + 1);
        console.log("Amount0 after adding liquidity: ", amount0Initial + amount0Expected + 1);
        console.log("Amount1 after adding liquidity: ", amount1Initial + amount1Expected + 1);
        // console.log("Tick Lower: ", info.tickLower());
        // console.log("Tick Upper: ", info.tickUpper());


        console.log("=== Get token reserve ===");
        uint256 reserve0 = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(poolManager));
        uint256 reserve1 = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(poolManager)); 

        console.log("Reserve0: ", reserve0);
        console.log("Reserve1: ", reserve1);

        

        console.log("============================================================");

    }
    function testDecreaseLiquidity() public {
        console.log("============================================================");

        console.log("=== Get position info ===");
        (uint128 liquidity) = positionManager.getPositionLiquidity(1);
        (PositionInfo info) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());


        console.log("=== Decrease liquidity ===");

        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));


        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(info.tickLower()),
            TickMath.getSqrtPriceAtTick(info.tickUpper()),
            liquidity
        );
         // emit log_named_uint("amount0Expected final", amount0Expected); //should be initial + after
        // emit log_named_uint("amount1Expected final", amount1Expected);
        uint256 min0 = (amount0Expected * 99) / 100; // 1% slippage
        uint256 min1 = (amount1Expected * 99) / 100;
        bytes[] memory params = new bytes[](2);
        uint256 tokenId = 1;
        params[0] = abi.encode(tokenId, liquidity, min0, min1, Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1, address(this));

                
        console.log("Liquidity before remove", liquidity);

        uint256 deadline = block.timestamp + 60;

        uint256 valueToPass = 0; // since I am not owing and I am not sending any ether
       

        positionManager.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            deadline
        );

        console.log("=== Get position info ===");
        (uint128 liquidity_) = positionManager.getPositionLiquidity(1);
        (PositionInfo info_) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96_,,,) = poolManager.getSlot0(poolKey.toId());

        (uint256 amount0ForPosition, uint256 amount1ForPosition) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96_,
            TickMath.getSqrtPriceAtTick(info_.tickLower()),
            TickMath.getSqrtPriceAtTick(info_.tickUpper()),
            liquidity_
        );
        console.log("Position liquidity: ", liquidity_);
        console.log("Amount0 after removing liquidity: ", amount0ForPosition);
        console.log("Amount1 after removing liquidity: ", amount1ForPosition);
        assertEq(liquidity_, 0);
        assertEq(amount0ForPosition, 0);
        assertEq(amount1ForPosition, 0);

        // console.log("Tick Lower: ", info.tickLower());
        // console.log("Tick Upper: ", info.tickUpper());

        console.log("=== Get token reserve ===");
        uint256 reserve0 = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(poolManager));
        uint256 reserve1 = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(poolManager)); 

        console.log("Reserve0: ", reserve0);
        console.log("Reserve1: ", reserve1);


        console.log("============================================================");

    }

    function testCollectFees() public {
        console.log("============================================================");

        console.log("=== Get position owner ===");
        uint256 tokenId = 1;
        address positionOwner = positionManager.ownerOf(tokenId);
        console.log("Position owner", positionOwner);
        assertEq(positionOwner, address(this));

        
        console.log("=== Calculate total fee earned by pool ===");
        (uint256 totalFees0, uint256 totalFees1) = getPoolTotalFees(poolManager, poolKey.toId());
        console.log("totalFees0", totalFees0);
        console.log("totalFees1", totalFees1);


        console.log("=== Calculate total fee earned by position and collect fees ===");
        (PositionInfo info) = positionManager.positionInfo(1);
        (int128 fees0, int128 fees1) = calculateFees(poolManager, poolKey.toId(), positionOwner, info.tickLower(), info.tickUpper(), 0);
        console.log("fees0", fees0);
        console.log("fees1", fees1);


        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, 0, 0, 0, Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1, address(this));

        uint256 deadline = block.timestamp + 60;

        positionManager.modifyLiquidities{value: 0}(
            abi.encode(actions, params),
            deadline
        );
        // in a normal day, check your balance of the 2 tokens before and after collecting fees



        console.log("============================================================");

    }

    function testBurnPosition() public {
        console.log("============================================================");

        console.log("=== Get position info ===");
        (uint128 liquidity) = positionManager.getPositionLiquidity(1);
        (PositionInfo info) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());

        console.log("=== Burn position ===");
        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(info.tickLower()),
            TickMath.getSqrtPriceAtTick(info.tickUpper()),
            liquidity
        );
        
        bytes memory actions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        uint256 tokenId = 1;
        params[0] = abi.encode(tokenId, amount0Expected, amount1Expected, Constants.ZERO_BYTES);
        params[1] = abi.encode(currency0, currency1, address(this));

        uint256 deadline = block.timestamp + 60;

        positionManager.modifyLiquidities(
            abi.encode(actions, params),
            deadline
        );
        console.log("=== Get position info ===");
        (uint128 liquidity_) = positionManager.getPositionLiquidity(1);
        (PositionInfo info_) = positionManager.positionInfo(1);
        (uint160 sqrtPriceX96_,,,) = poolManager.getSlot0(poolKey.toId());

        (uint256 amount0ForPosition, uint256 amount1ForPosition) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96_,
            TickMath.getSqrtPriceAtTick(info_.tickLower()),
            TickMath.getSqrtPriceAtTick(info_.tickUpper()),
            liquidity_
        );
        console.log("Position liquidity: ", liquidity_);
        console.log("Amount0 after removing liquidity: ", amount0ForPosition);
        console.log("Amount1 after removing liquidity: ", amount1ForPosition);
        assertEq(liquidity_, 0);
        assertEq(amount0ForPosition, 0);
        assertEq(amount1ForPosition, 0);

        console.log("=== Get token reserve ===");
        uint256 reserve0 = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(poolManager));
        uint256 reserve1 = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(poolManager)); 

        console.log("Reserve0: ", reserve0);
        console.log("Reserve1: ", reserve1);


        console.log("============================================================");


    }




    function calculateFees(
        IPoolManager manager,
        PoolId poolId_,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        bytes32 salt
    ) internal view returns (int128, int128) {
        bytes32 positionKey = Position.calculatePositionKey(owner, tickLower, tickUpper, salt);
        (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128) =
            StateLibrary.getPositionInfo(manager, poolId_, positionKey);

        (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) =
            StateLibrary.getFeeGrowthInside(manager, poolId_, tickLower, tickUpper);

        uint256 fees0 = FullMath.mulDiv(feeGrowthInside0X128 - feeGrowthInside0LastX128, liquidity, FixedPoint128.Q128);
        uint256 fees1 = FullMath.mulDiv(feeGrowthInside1X128 - feeGrowthInside1LastX128, liquidity, FixedPoint128.Q128);

        return (int128(int256(fees0)), int128(int256(fees1)));
    }


    function getPoolTotalFees(IPoolManager manager, PoolId poolId_) internal view returns (uint256, uint256) {
        (uint256 feeGrowthGlobal0X128, uint256 feeGrowthGlobal1X128) = manager.getFeeGrowthGlobals(poolId_);
        uint128 totalLiquidity = manager.getLiquidity(poolId_);
        uint256 totalFees0 = FullMath.mulDiv(feeGrowthGlobal0X128, totalLiquidity, FixedPoint128.Q128);
        uint256 totalFees1 = FullMath.mulDiv(feeGrowthGlobal1X128, totalLiquidity, FixedPoint128.Q128);
        return (totalFees0, totalFees1);

    }

}
