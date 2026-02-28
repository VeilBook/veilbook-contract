import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { ContractTransactionReceipt, ethers } from "ethers";
import _deployments_ from "../deploy/deployments";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from "hardhat/types";
import { formatUnits } from "ethers";
import { getContracts} from "./contracts";

export async function checkApprovals(
    tokenAddress: string,
    permit2Address: string,
    posmAddress: string,
    ownerAddress: string,
    provider: HardhatEthersProvider,

) {
    // 1. Setup Contracts

    const tokenContract = new ethers.Contract(tokenAddress, _deployments_.ERC20_ABI, provider);
    const permit2Contract = new ethers.Contract(permit2Address, _deployments_.PERMIT2_ABI, provider);

    // 2. Fetch Layer 1: Token -> Permit2
    // This is a standard ERC20 allowance. It usually doesn't have a deadline.
    const tokenToPermit2 = await tokenContract.allowance(ownerAddress, permit2Address);

    // 3. Fetch Layer 2: Permit2 -> Position Manager
    // Permit2 returns a tuple: [amount, expiration, nonce]
    const [p2ToPosmAmount, p2ToPosmExpiration] = await permit2Contract.allowance(
        ownerAddress,
        tokenAddress,
        posmAddress
    );

    return {
        tokenToPermit2,          // BigInt: Standard ERC20 allowance
        p2ToPosmAmount,          // BigInt: Permit2's internal allowance for POSM
        p2ToPosmExpiration       // Number: Unix timestamp when Permit2 allowance expires
    };
}

export async function approveTokenWithPermit2(
    permit2Address: string,
    spender: string,
    token: string,
    tokenAmount: string | bigint,
    signer: HardhatEthersSigner
): Promise<void> {

    const tokenContract = new ethers.Contract(
        token, 
        ["function approve(address spender, uint256 amount) public returns (bool)"], 
        signer
    );

    console.log("Approving Permit2...");
    const tx1 = await tokenContract.approve(permit2Address, tokenAmount);
    await tx1.wait();

    // 2. Approve Position Manager via Permit2
    const permit2Abi = [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
    ];
    const permit2Contract = new ethers.Contract(permit2Address, permit2Abi, signer);

    console.log("Allowing Position Manager to use Permit2...");
    const tx2 = await permit2Contract.approve(
        token, 
        spender, 
        tokenAmount,
        Math.floor(Date.now() / 1000) + 3600 // Expiration (1 hour)
    );
    await tx2.wait();
}

export const getPositionId = async(receipt: ContractTransactionReceipt | null) => {

    // Find the Transfer event (topic[0] for Transfer is 0xddf2...)
    console.log("logs: ", receipt?.logs);
    const transferEvent = receipt?.logs.find(
        log => log.address.toLowerCase() === _deployments_.POSITION_MANAGER_ADDRESS.toLowerCase()
    );

    if (transferEvent) {
        // In ERC-721, the 3rd index (topic[3]) is the tokenId
        const tokenId = BigInt(transferEvent.topics[3]);
        console.log("Minted Token ID:", tokenId.toString());
        return tokenId.toString();
    };
    
}

export const getLogEvents = async(logs: any, signer: HardhatEthersSigner) => {
    const POOL_MANAGER_CONTRACT = new ethers.Contract(_deployments_.POOL_MANAGER_ADDRESS, _deployments_.POOL_MANAGER_ABI, signer);
    logs.forEach((log: any) => {
        try {
            // Attempt to parse the log using the contract interface
            const parsedLog = POOL_MANAGER_CONTRACT.interface.parseLog(log);
            console.log("parsedLog: ", parsedLog)
            
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
}

// e.g -> IncreaseLiquidity(uint256,uint128,uint256,uint256)
export const getEventSignature = (eventName: any, abi: any) => {
    const eventAbi = abi.find((entry: any) => entry.name === eventName);
    const types = eventAbi.inputs.map((input: any) => input.type);
    return `${eventName}(${types.join(',')})`;
}

export const getPositionInfo = async(id: string | number, provider: HardhatEthersProvider) => {
    const POSITION_MANAGER_CONTRACT = new ethers.Contract(_deployments_.POSITION_MANAGER_ADDRESS, _deployments_.POSITION_MANAGER_ABI, provider);
    const [positionLiquidity, owner] = await Promise.all([
        POSITION_MANAGER_CONTRACT.getPositionLiquidity(id),
        POSITION_MANAGER_CONTRACT.ownerOf(id),
     ])
    return {positionLiquidity, owner};
    
}


// export async function getFunds(MY_ADDRESS: any, amount: any, hre: HardhatRuntimeEnvironment) {
   
//     const { ethers, network } = hre;
//     // const signer = (await ethers.getSigners())[0];
//     const WHALE_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60"; // Binance

//     // A. EXPLICITLY UNLOCK THE ACCOUNT
//     await network.provider.request({
//         method: "hardhat_impersonateAccount",
//         params: [WHALE_ADDRESS],
//     });

//     // B. GIVE THE WHALE GAS (The "Safe-Bet" Step)
//     // If the whale has 0 ETH, they can't pay for the USDC transfer.

//     await network.provider.send("hardhat_setBalance", [
//         WHALE_ADDRESS,
//         "0x1000000000000000000", // 1 ETH  // "0x3635C9ADC5DEA00000", // 1000 ETH
//     ]);

//     // Get the Whale Signer
//     // const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);
//     const whaleSigner = await ethers.getImpersonatedSigner(WHALE_ADDRESS);
    

//     console.log("Impersonation function")

   

//     // 2. Connect to the USDC Contract
//     const { erc20Contract } = getContracts(whaleSigner);
    
//     console.log("Transferring USDC from whale...");
//     // TypeScript tells us usdc is of type BaseContract, which does not have type-safe .transfer. Use any-cast or add ABI.
//     const tx = await erc20Contract.transfer(MY_ADDRESS, amount);
//     await tx.wait();
//     console.log("Transfer done...");

//     const myBalance = await erc20Contract.balanceOf(MY_ADDRESS);

//     console.log(`Success! My balance: ${formatUnits(myBalance, 6)} USDC`);
// }


export async function getFunds(
    MY_ADDRESS: string,
    amount: string,
    hre: HardhatRuntimeEnvironment
  ) {
    const { ethers, network } = hre;
  
    const WHALE_ADDRESS = "0xaD354CfBAa4A8572DD6Df021514a3931A8329Ef5"; // Binance
  
    // 1️⃣ Impersonate FIRST
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDRESS],
    });
  
    // 2️⃣ Fund whale for gas
    await network.provider.send("hardhat_setBalance", [
      WHALE_ADDRESS,
      "0x3635C9ADC5DEA00000", // 1000 ETH
    ]);
  
    // 3️⃣ Get signer AFTER impersonation
    const whaleSigner = await ethers.getImpersonatedSigner(WHALE_ADDRESS);
  
    // 4️⃣ Get USDC contract CONNECTED to whale
    const usdc = new ethers.Contract(_deployments_.USDC_ADDRESS, _deployments_.ERC20_ABI, whaleSigner);

    const myBalanceBefore = await usdc.balanceOf(MY_ADDRESS);
    console.log(`Success! My balance before: ${ethers.formatUnits(myBalanceBefore, 6)} USDC`);
  
    console.log("Transferring USDC from whale...");
  
    const tx = await usdc.transfer(
      MY_ADDRESS,
      amount
    );
    await tx.wait();
  
    // const myBalanceAfter = await usdc.balanceOf(MY_ADDRESS);
    // console.log(`Success! My balance after: ${ethers.formatUnits(myBalanceAfter, 6)} USDC`);
    // return myBalance;
}
  