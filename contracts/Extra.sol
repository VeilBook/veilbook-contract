// // Step 1: Deploy DeterministicDeployFactory
//   console.log("\n1. Deploying DeterministicDeployFactory...");
//   const DeterministicDeployFactory = await ethers.getContractFactory("DeterministicDeployFactory");
//   const factory = await DeterministicDeployFactory.deploy();
//   await factory.waitForDeployment();
//   const factoryAddress = await factory.getAddress();
//   console.log("DeterministicDeployFactory deployed to:", factoryAddress);

//   // Step 2: Get the PoolManager address
//   // In production, this should be the actual Uniswap v4 PoolManager address
//   // For now, we'll deploy a new one for demonstration
//   console.log("\n2. Getting PoolManager address...");
//   const PoolManager = await ethers.getContractFactory("PoolManager");
//   const poolManager = await PoolManager.deploy(deployer.address);
//   await poolManager.waitForDeployment();
//   const poolManagerAddress = await poolManager.getAddress();
//   console.log("PoolManager address:", poolManagerAddress);

//   // Step 3: Calculate the required hook flags
//   // CounterHook uses: beforeSwap, afterSwap, beforeAddLiquidity, beforeRemoveLiquidity
//   console.log("\n3. Calculating required hook flags...");

//   const BEFORE_SWAP_FLAG = 1n << 7n;
//   const AFTER_SWAP_FLAG = 1n << 6n;
//   const BEFORE_ADD_LIQUIDITY_FLAG = 1n << 3n;
//   const BEFORE_REMOVE_LIQUIDITY_FLAG = 1n << 1n;

//   const requiredFlags = BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG |
//                        BEFORE_ADD_LIQUIDITY_FLAG | BEFORE_REMOVE_LIQUIDITY_FLAG;

//   console.log("Required flags:", requiredFlags.toString(16));

//   // Step 4: Get the bytecode for CounterHook
//   console.log("\n4. Preparing CounterHook bytecode...");
//   const CounterHookFactory = await ethers.getContractFactory("CounterHook");
//   const deploymentData = CounterHookFactory.getDeployTransaction(poolManagerAddress);
//   const bytecode = deploymentData.data as string;
//   console.log("Bytecode length:", bytecode.length);

//   // Step 5: Find a salt that gives us an address with the correct flags
//   console.log("\n5. Finding salt for correct address...");
//   console.log("This may take a while...");

//   let salt = 0n;
//   let targetAddress = "";
//   let found = false;
//   const maxIterations = 100000; // Limit iterations for demo

//   for (let i = 0; i < maxIterations && !found; i++) {
//     salt = BigInt(i);
//     targetAddress = await factory.computeAddress(bytecode, salt);

//     // Extract flags from address (last 2 bytes before the checksum)
//     const addressBigInt = BigInt(targetAddress);
//     const addressFlags = (addressBigInt >> 144n) & 0xFFFFn;

//     // Check if the address flags match our required flags
//     // The address must have the required bits set
//     if ((addressFlags & requiredFlags) === requiredFlags) {
//       found = true;
//       console.log("\n✓ Found valid address!");
//       console.log("Salt:", salt.toString());
//       console.log("Address:", targetAddress);
//       console.log("Address flags:", addressFlags.toString(16));
//       break;
//     }

//     if (i % 10000 === 0 && i > 0) {
//       console.log(`Tried ${i} salts...`);
//     }
//   }

//   if (!found) {
//     console.log("\n⚠ Could not find valid address in", maxIterations, "iterations");
//     console.log("In production, you would continue searching or use a different namespace");
//     console.log("\nAlternatively, you can:");
//     console.log("1. Use Foundry's vm.etch() to deploy to any address (testing only)");
//     console.log("2. Mine for a salt offchain with more iterations");
//     console.log("3. Use the namespace trick: XOR with a namespace value");
//     return;
//   }

//   // Step 6: Deploy the hook using the found salt
//   console.log("\n6. Deploying CounterHook to computed address...");
//   const deployTx = await factory.deploy(bytecode, salt);
//   await deployTx.wait();

//   console.log("\n✓ CounterHook deployed successfully!");
//   console.log("Address:", targetAddress);

//   // Step 7: Verify the deployment
//   console.log("\n7. Verifying deployment...");
//   const deployedCode = await ethers.provider.getCode(targetAddress);
//   if (deployedCode !== "0x") {
//     console.log("✓ Contract deployed and verified!");
//   } else {
//     console.log("✗ Deployment verification failed");
//   }

//   // Summary
//   console.log("\n" + "=".repeat(80));
//   console.log("DEPLOYMENT SUMMARY");
//   console.log("=".repeat(80));
//   console.log("DeterministicDeployFactory:", factoryAddress);
//   console.log("PoolManager:", poolManagerAddress);
//   console.log("CounterHook:", targetAddress);
//   console.log("Salt used:", salt.toString());
//   console.log("=".repeat(80));


// 3 — Deploy VeilBook via hardhat_setCode (CREATE2 fails with VeilBook's complex constructor)
  // Uniswap v4 hooks require the address itself to encode permission flags in the low 14 bits.
  // Per Hooks.sol: AFTER_INITIALIZE = 1<<12, AFTER_SWAP = 1<<6 → need 0x1040
//   console.log("\n  Deploying VeilBook hook (hardhat_setCode at flag-compliant address)...");
//   const VeilBookHookFactory = await ethers.getContractFactory("VeilBook", deployer);
//   const tempHook = await VeilBookHookFactory.deploy(POOL_MANAGER_ADDRESS);
//   await tempHook.waitForDeployment();
//   const runtimeBytecode = await ethers.provider!.getCode(await tempHook.getAddress());

//   // Use address with correct hook flags in low bits (Uniswap v4 validates address)
//   const hookAddress = "0x0000000000000000000000000000000000001040";
//   await ethers.provider!.send("hardhat_setCode", [hookAddress, runtimeBytecode]);

//   hook = VeilBookHookFactory.attach(hookAddress) as unknown as VeilBook;
//   console.log("  VeilBook Hook:", hookAddress);

//.............................................................................................