// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/Console.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


import {BaseTest} from "./utils/BaseTest.sol";


contract Pool is BaseTest {
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


        console.log("============================================================");
    }

    function test() public {
        
        console.log("WETH address: ", address(weth));
        console.log("Router address: ", address(router));
        console.log("Quoter address: ", address(quoter));
        console.log("lpRouter: ", address(lpRouter));
        console.log("Permit2 address: ", address(permit2));
        console.log("Currency0 Amount: ", IERC20(Currency.unwrap(currency0)).balanceOf(address(this)));
        console.log("Currency1 Amount: ", IERC20(Currency.unwrap(currency1)).balanceOf(address(this)));

    }

}
