// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IUniswapV4Router04} from "hookmate/interfaces/router/IUniswapV4Router04.sol";

import {AddressConstants} from "hookmate/constants/AddressConstants.sol";
import {Permit2Deployer} from "hookmate/artifacts/Permit2.sol";
import {V4PoolManagerDeployer} from "hookmate/artifacts/V4PoolManager.sol";
import {V4PositionManagerDeployer} from "hookmate/artifacts/V4PositionManager.sol";
import {V4RouterDeployer} from "hookmate/artifacts/V4Router.sol";

import {UniversalRouter} from "@uniswap/universal-router/contracts/UniversalRouter.sol";
import {IUniversalRouter} from "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";

import { V4Quoter } from "@uniswap/v4-periphery/src/lens/V4Quoter.sol";
import { IV4Quoter } from "@uniswap/v4-periphery/src/interfaces/IV4Quoter.sol";


import {WETH} from "solmate/src/tokens/WETH.sol";
import {RouterParameters} from '@uniswap/universal-router/contracts/types/RouterParameters.sol';

import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";


/**
 * Base Deployer Contract for Hook Testing
 *
 * Automatically does the following:
 * 1. Setup deployments for Permit2, PoolManager, PositionManager and V4SwapRouter.
 * 2. Check if chainId is 31337, is so, deploys local instances.
 * 3. If not, uses existing canonical deployments on the selected network.
 * 4. Provides utility functions to deploy tokens and currency pairs.
 *
 * This contract can be used for both local testing and fork testing.
 */
abstract contract Deployers {
    IPermit2 permit2;
    IPoolManager poolManager;
    IPositionManager positionManager;
    IUniswapV4Router04 swapRouter;

    WETH weth;
    IUniversalRouter router;
    IV4Quoter quoter;
    PoolModifyLiquidityTest lpRouter;

    function deployToken(address _to) internal returns (MockERC20 token) {
        token = new MockERC20("Test Token", "TEST", 18);
        token.mint(_to, 10_000_000 ether); // 
        token.mint(address(this), 10_000_000 ether);

        token.approve(address(permit2), type(uint256).max);
        token.approve(address(swapRouter), type(uint256).max);

        permit2.approve(address(token), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token), address(poolManager), type(uint160).max, type(uint48).max);
    }

    function deployCurrencyPair(address _to) internal virtual returns (Currency currency0, Currency currency1) {
        MockERC20 token0 = deployToken(_to);
        MockERC20 token1 = deployToken(_to);

        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));
    }

    function deployPermit2() internal {
        address permit2Address = AddressConstants.getPermit2Address();

        if (permit2Address.code.length > 0) {
            // Permit2 is already deployed, no need to etch it.
        } else {
            _etch(permit2Address, Permit2Deployer.deploy().code);
        }

        permit2 = IPermit2(permit2Address);
    }

    function deployPoolManager() internal virtual {
        if (block.chainid == 31337) {
            poolManager = IPoolManager(V4PoolManagerDeployer.deploy(address(0x4444)));
        } else {
            poolManager = IPoolManager(AddressConstants.getPoolManagerAddress(block.chainid));
        }
    }

    function deployPositionManager() internal virtual {
        if (block.chainid == 31337) {
            positionManager = IPositionManager(
                V4PositionManagerDeployer.deploy(
                    address(poolManager), address(permit2), 300_000, address(0), address(0)
                )
            );
        } else {
            positionManager = IPositionManager(AddressConstants.getPositionManagerAddress(block.chainid));
        }
    }

    function deployRouter() internal virtual {
        if (block.chainid == 31337) {
            swapRouter = IUniswapV4Router04(payable(V4RouterDeployer.deploy(address(poolManager), address(permit2))));
        } else {
            swapRouter = IUniswapV4Router04(payable(AddressConstants.getV4SwapRouterAddress(block.chainid)));
        }
    }



    function deployWETH() internal {
        weth = new WETH();
    }

    function deployV4Router() internal {
        require(address(weth) != address(0), "WETH not deployed");
        
        RouterParameters memory params = RouterParameters({
            permit2: address(permit2),
            weth9: address(weth),
            v2Factory: address(0),
            v3Factory: address(0),
            pairInitCodeHash: bytes32(0),
            poolInitCodeHash: bytes32(0),
            v4PoolManager: address(poolManager),
            v3NFTPositionManager: address(0),
            v4PositionManager: address(positionManager),
            spokePool: address(0)
        });

        router = IUniversalRouter(address(new UniversalRouter(params)));

    }

    function deployV4Quoter() internal {
        quoter = IV4Quoter(address(new V4Quoter(poolManager)));
    }

    function deployPoolModifyLiquidityTest() internal {
        lpRouter = new PoolModifyLiquidityTest(poolManager);
    } 



    function _etch(address, bytes memory) internal virtual {
        revert("Not implemented");
    }

    function deployArtifacts() internal {
        // Order matters.
        deployPermit2();
        deployPoolManager();
        deployPositionManager();
        deployRouter();

        deployWETH();
        deployV4Router();
        deployV4Quoter();
        deployPoolModifyLiquidityTest();
    }
}