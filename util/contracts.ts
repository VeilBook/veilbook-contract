import { Contract } from "ethers";
import _deployments_ from "../deploy/deployments";


export const getContracts = (signerOrProvider: any) => {
    return {
        poolManagerContract: new Contract(
            _deployments_.POOL_MANAGER_ADDRESS,
            _deployments_.POOL_MANAGER_ABI, 
            signerOrProvider
        ),
        posmContract: new Contract(
            _deployments_.POSITION_MANAGER_ADDRESS, 
            _deployments_.POSITION_MANAGER_ABI, 
            signerOrProvider
        ),
        stateViewContract: new Contract(
            _deployments_.STATE_VIEW_ADDRESS,
            _deployments_.STATE_VIEW_ABI, 
            signerOrProvider
        ),
        erc20Contract: new Contract(
            _deployments_.USDC_ADDRESS, 
            _deployments_.ERC20_ABI, 
            signerOrProvider
        ),

       
    };
};
