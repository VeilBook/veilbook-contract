
import { ethers } from "hardhat";
async function main() {

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address: ", deployer.address)
  let hookAddress = "";
  let salt = "";
  let finalAddress: string = "";


  const poolManagerAddress = "0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D";


  const hookFactory = await ethers.getContractFactory("VeilBookFactory");
  const hookFactoryContract = await hookFactory.deploy();
  await hookFactoryContract.waitForDeployment();
  const hookFactoryAddress = await hookFactoryContract.getAddress();
  console.log("VeilBookFactory address:", hookFactoryAddress);

  const AFTER_INITIALIZE_FLAG = 1n << 12n;
  const AFTER_SWAP_FLAG       = 1n << 6n;
  const requiredFlags = AFTER_INITIALIZE_FLAG | AFTER_SWAP_FLAG; // 0x1040


  for (let i = 0; i < 200000; i++) {
    salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
    const expectedAddress = await hookFactoryContract.getPrecomputedHookAddress(
        poolManagerAddress,
        salt
    );

  const flags = BigInt(expectedAddress) & 0x3FFFn;
  if (flags === requiredFlags) {
      finalAddress = expectedAddress;
      console.log(`Found valid address at salt=${i}: ${finalAddress}`);
      console.log(`Flags: 0x${flags.toString(16)}`);
      break;
  }
}
hookAddress = finalAddress;
await hookFactoryContract.deploy(poolManagerAddress, salt);
console.log(`VeilBook Hook deployed at: ${hookAddress} and salt = ${salt}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVeilBookHook.ts --network sepolia

// VeilBookFactory address: 0x0f2005c708Cf14fDd827F068D8433ed0283ecEA9
// Found valid address at salt=4685: 0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040
// Flags: 0x1040
// VeilBook Hook deployed at: 0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040 and salt = 0x000000000000000000000000000000000000000000000000000000000000124d

