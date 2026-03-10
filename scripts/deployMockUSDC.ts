
import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. deploy factory
  const Factory = await ethers.getContractFactory("MockUSDCFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("Factory deployed at:", factoryAddress);

  // 2. mine salt
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const initCodeHash = ethers.keccak256(
    ethers.concat([
      MockERC20.bytecode,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        ["USD Coin", "USDC"]
      ),
    ])
  );

  console.log("Mining salt for 5 leading zeros...");
  const TARGET_PREFIX = "0xff";
  let winningSalt = "";
  let winningAddress = "";

  for (let i = 0; i < 10_000_000; i++) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
    const address = ethers.getCreate2Address(factoryAddress, salt, initCodeHash);

    if (address.toLowerCase().startsWith(TARGET_PREFIX)) {
      winningSalt = salt;
      winningAddress = address;
      console.log(`✅ Found at salt: ${i}`);
      console.log("Predicted address:", winningAddress);
      break;
    }

    if (i % 100_000 === 0 && i !== 0) console.log(`Checked ${i} salts...`);
  }

  if (!winningSalt) throw new Error("No salt found, increase iterations");

  // 3. deploy via factory
  const tx = await factory.deploy(winningSalt);
  await tx.wait();
  console.log("✅ MockUSDC deployed at:", winningAddress);
}

main().catch(console.error);

//npx hardhat run scripts/deployMockUSDC.ts --network sepolia
// ✅ MockUSDC deployed at: 0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d
