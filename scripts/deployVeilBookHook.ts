
import { ethers } from "hardhat";
async function main() {

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address: ", deployer.address)
  let hookAddress = "";
  let salt = "";
  let finalAddress: string = "";


  const poolManagerAddress = "0x1F6531C33e88d7eA0DfF8eAB7cBDbB19d64C6e20";


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
// hookAddress = "0xB91AFBD725A68C738C0A1A37d2D5B9Dc829fd040";
// let salt: string = ethers.zeroPadValue(ethers.toBeHex(11858), 32)
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

// Deployer Address:  0x5Ac521f6814c2D09188A6838e7CDBfe7aEaC0cf9
// VeilBookFactory address: 0x49DA1845977B92E2e6a6ba3953C5Cee6aEE4da4e
// Found valid address at salt=12616: 0x203090B459Ce722f9F6467BC658F64B907e3D040
// Flags: 0x1040
// VeilBook Hook deployed at: 0x203090B459Ce722f9F6467BC658F64B907e3D040 and salt = 0x0000000000000000000000000000000000000000000000000000000000003148