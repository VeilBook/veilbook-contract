

// import { ethers } from "hardhat";

// async function main() {

//   const [deployer] = await ethers.getSigners();
//   console.log("Deploying contracts with account:", deployer.address);

//   // ----------------------
//   // Step 1: Deploy factory
//   // ----------------------
//   console.log("\n1. Deploying DeterministicDeployFactory...");
//   const DeterministicDeployFactory = await ethers.getContractFactory("DeterministicDeployFactory");
//   const factory = await DeterministicDeployFactory.deploy();
//   await factory.waitForDeployment();
//   const factoryAddress = await factory.getAddress();
//   console.log("DeterministicDeployFactory deployed to:", factoryAddress);

//   // ----------------------
//   // Step 2: Deploy PoolManager (demo)
//   // ----------------------
//   console.log("\n2. Deploying PoolManager...");
//   const PoolManager = await ethers.getContractFactory("PoolManager");
//   const poolManager = await PoolManager.deploy(deployer.address);
//   await poolManager.waitForDeployment();
//   const poolManagerAddress = await poolManager.getAddress();
//   console.log("PoolManager address:", poolManagerAddress);

//   // ----------------------
//   // Step 3: Set required flags
//   // ----------------------
//   console.log("\n3. Setting required hook flags...");
//   const AFTER_INITIALIZE_FLAG = 1n << 12n;
//   const AFTER_SWAP_FLAG = 1n << 6n;
//   const requiredFlags = AFTER_INITIALIZE_FLAG | AFTER_SWAP_FLAG;
//   console.log("Required flags (hex):", requiredFlags.toString(16));

//   // ----------------------
//   // Step 4: Prepare init code
//   // ----------------------
//   console.log("\n4. Preparing VeilBook init code...");
//   const VeilBookFactory = await ethers.getContractFactory("VeilBook");
//   // const initCode = VeilBookFactory.bytecode + ethers.AbiCoder.defaultAbiCoder().encode(["address"], [poolManagerAddress]).slice(2);
//   const initCode = (await VeilBookFactory.getDeployTransaction(poolManagerAddress)).data as string;

//   console.log("Init code length:", initCode.length);

//   // ----------------------
//   // Step 5: Mine a salt
//   // ----------------------
//   console.log("\n5. Finding salt for correct address...");
//   let salt = 0n;
//   let targetAddress = "";
//   let found = false;
//   const maxIterations = 1_000_000;

//   for (let i = 0; i < maxIterations && !found; i++) {
//     salt = BigInt(i);
//     targetAddress = await factory.computeAddress(initCode, salt);

//     // Extract lowest 14 bits (flags)
//     const addressBigInt = BigInt(targetAddress);
    
//     // const addressFlags = (addressBigInt >> 144n) & 0xFFFFn;
//     const addressFlags = addressBigInt & 0x3FFFn;


//     if (addressFlags === requiredFlags) {
//       found = true;
//       console.log("\n✓ Found valid address!");
//       console.log("Salt:", salt.toString());
//       console.log("Address:", targetAddress);
//       console.log("Address flags:", addressFlags.toString(16));
//       break;
//     }

//     if (i % 10000 === 0 && i > 0) console.log(`Tried ${i} salts...`);
//   }

//   if (!found) {
//     console.log("\n⚠ Could not find valid address in", maxIterations, "iterations");
//     console.log("Increase iterations or mine off-chain for production.");
//     return;
//   }

//   // ----------------------
//   // Step 6: Deploy VeilBook
//   // ----------------------
//   console.log("\n6. Deploying VeilBook to computed address...");
//   const deployTx = await factory.deploy(initCode, salt);
//   await deployTx.wait();
//   console.log("\n✓ VeilBook deployed successfully!");
//   console.log("Address:", targetAddress);

//   // ----------------------
//   // Step 7: Verify deployment


// // ----------------------
//   console.log("\n7. Verifying deployment...");
//   const deployedCode = await ethers.provider.getCode(targetAddress);
//   if (deployedCode !== "0x") {
//     console.log("✓ Contract deployed and verified!");
//   } else {
//     console.log("✗ Deployment verification failed");
//   }

//   // ----------------------
//   // Summary
//   // ----------------------
//   console.log("\n" + "=".repeat(80));
//   console.log("DEPLOYMENT SUMMARY");
//   console.log("=".repeat(80));
//   console.log("DeterministicDeployFactory:", factoryAddress);
//   console.log("PoolManager:", poolManagerAddress);
//   console.log("VeilBook:", targetAddress);
//   console.log("Salt used:", salt.toString());
//   console.log("=".repeat(80));
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });


import { ethers } from "hardhat";
async function main() {

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

const hookFactory = await ethers.getContractFactory("VeilBookFactory");
const hookFactoryContract = await hookFactory.deploy();
await hookFactoryContract.waitForDeployment();
const hookFactoryAddress = await hookFactoryContract.getAddress();
console.log("VeilBookFactory address:", hookFactoryAddress);

const AFTER_INITIALIZE_FLAG = 1n << 12n;
const AFTER_SWAP_FLAG       = 1n << 6n;
const requiredFlags = AFTER_INITIALIZE_FLAG | AFTER_SWAP_FLAG; // 0x1040

let salt: string = "";
let finalAddress: string = "";

  // ----------------------
  // Step 2: Deploy PoolManager (demo)
  // ----------------------
  console.log("\n2. Deploying PoolManager...");
  const PoolManager = await ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy(deployer.address);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("PoolManager address:", poolManagerAddress);


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


await hookFactoryContract.deploy(poolManagerAddress, salt);
console.log("VeilBook Hook deployed at:", finalAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


//   PoolManager address: 0x2d929838d32Ea33a0994D37F82965C2d284E3b4F
// Found valid address at salt=23001: 0x983d7ee62Ebfba25beEd2Da09086149fB16f9040
// Flags: 0x1040
// VeilBook Hook deployed at: 0x983d7ee62Ebfba25beEd2Da09086149fB16f9040