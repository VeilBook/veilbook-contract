
import { ethers } from "hardhat";
async function main() {

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  let poolManagerAddress ="";
  let hookAddress = "";
  let salt = "";
  let finalAddress: string = "";



  // Deploy PoolManager
  const PoolManagerFactory = await ethers.getContractFactory(
    "PoolManager",
    deployer
  );
  const poolManagerContract = await PoolManagerFactory.deploy(await deployer.getAddress());
  await poolManagerContract.waitForDeployment();

  poolManagerAddress = await poolManagerContract.getAddress();

  console.log("PoolManager deployed at:", poolManagerAddress);


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

//npx hardhat run scripts/deployVeilBookHook.ts
  // Found valid address at salt=14601
// Flags: 0x1040
// VeilBook Hook deployed at: 0x8c023776bA02c85B53B5C468F1F43c0dc1d15040