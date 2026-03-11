# VeilBook

**Confidential Limit Order Book on Uniswap V4**  
Powered by Zama fhEVM · Deployed on Sepolia

---

## Overview

VeilBook is a confidential limit order book hook built on Uniswap V4. Orders are encrypted using Zama's fhEVM (Fully Homomorphic Encryption) — amounts remain private onchain at all times. Matching happens directly inside the hook's **afterSwap** callback, enabling trustless, MEV-resistant, confidential trading.

Key properties:
- Order amounts are encrypted as `euint64` — never exposed onchain
- Matching occurs inside `afterSwap` — no external keeper required
- Users decrypt their own filled amounts client-side via Zama Relayer
- All pools share a single VeilBook hook via Uniswap V4's hook architecture

---

## Architecture

### Smart Contracts

VeilBook is a Uniswap V4 hook contract. It implements:

- `afterSwap` — matches the completed swap against resting limit orders at the target tick
- `deposit()` — accepts plaintext tokens and mints encrypted ERC20 balance to the user
- `placeOrder()` — creates an encrypted limit order using the user's encrypted token balance
- `cancelOrder()` — cancels an active order and returns unfilled balance
- `claimFill()` — lets users withdraw filled output tokens

### Encrypted Token Flow

Each pool has two EncryptedERC20 contracts (one per currency). When a user deposits:

1. Plaintext tokens transferred into VeilBook
2. Equivalent `euint64` minted to user in the EncryptedERC20 contract
3. User calls `setOperator()` to authorize VeilBook to move their encrypted tokens
4. `placeOrder()` pulls encrypted tokens from user using the operator permission

### Order Matching

When a swap executes through the pool, `afterSwap` loops through resting orders at the current tick. If a matching order exists (opposing direction), amounts are transferred using FHE arithmetic — no plaintext values are revealed during matching.

---

## Deployed Addresses

**Network: Ethereum Sepolia Testnet**

### Core Protocol

| Contract | Address |
|---|---|
| VeilBook Hook | `0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040` |
| MockUSDC | `0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d` |
| PoolManager | `0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D` |

### Mock Tokens

| Token | Address |
|---|---|
| NBL (Nebula) | `0x5EDB776E0e8324609276De545118E5f4ef0e820B` |
| SLR (Solaris) | `0x2f1b32866FFF6c5c48324806A94a3766cF69861D` |
| ATH (Aether) | `0x3dC4270317C33873538EfBE05F22711F33187FEa` |
| VTX (Vortex) | `0x3C8330c0A975b77bc9d809b75d32ACee49C64cc9` |
| ZTA | `0xBce34969854a0950788f248D18B997b8b05798F9` |

### Hook Deployment

- Hook flags: `0x1040` (afterInitialize and afterSwap)
- CREATE2 salt: `0x000000000000000000000000000000000000000000000000000000000000124d`

---

## Pool Configuration

All pools share the same default configuration, but you can choose your own fee tier, tick spacing, and hook flags when deploying your own pools.

| Parameter | Value |
|---|---|
| Fee tier | 3000 (0.3%) |
| Tick spacing | 60 |
| Hook | `0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040` |
| Quote token | MockUSDC (currency1) |

**Active pools:** NBL/USDC, SLR/USDC, ATH/USDC, VTX/USDC, ZTA/USDC

---

## Deployment

### Prerequisites

- Node.js >= 18
- Hardhat with TypeScript
- `.env` with `MNEMONIC` and `INFURA_API_KEY`

### .env Setup

```
MNEMONIC=your twelve word mnemonic phrase here
INFURA_API_KEY=your_infura_api_key
```

### Deploy Steps

Run each command in order:

```bash
npx hardhat deploy --tags MockERC20 --network sepolia
npx hardhat deploy --tags PoolManager --network sepolia
npx hardhat deploy --tags PoolModifyLiquidityTest --network sepolia
npx hardhat deploy --tags PoolSwapTest --network sepolia
npx hardhat deploy --tags StateView --network sepolia
npx hardhat run scripts/deployMockUSDC.ts --network sepolia
npx hardhat run scripts/deployVeilBookHook.ts --network sepolia
```

---

## Testing

```bash
npx hardhat test
```

### What the Test Covers

The test suite walks through the full lifecycle of a confidential limit order:

1. **Deposit** — User approves and deposits tokens into VeilBook. Plaintext tokens are transferred in and encrypted ERC20 balance is minted to the user
2. **Get encrypted token** — User retrieves the EncryptedERC20 token address for their pool and currency via `getEncryptedToken()`
3. **Set operator** — User calls `setOperator()` on the EncryptedERC20 to authorize VeilBook to spend their encrypted balance
4. **Place order** — User encrypts their order amount client-side using the Zama SDK and calls `placeOrder()`. The encrypted amount is pulled from their balance and stored as an active limit order
5. **Swap & match** — A counterparty swap executes through the pool. `afterSwap` fires and matches the swap against the resting order using FHE arithmetic
6. **Get order** — User calls `getOrder()` and receives `euint64` handles for `filledIn` and `filledOut`
7. **Decrypt** — User decrypts `filledIn` and `filledOut` via the Zama Relayer using an EIP-712 signature. Amounts are revealed only to the user
8. **Claim** — User calls `claimFill()` with the plaintext `filledOut` amount to withdraw their filled output tokens

---

## FHE / Zama Notes

### Encrypted Handles

`euint64` values returned from `getOrder()` are ciphertext handles (`uint256`). To decrypt client-side:

- Convert handle to hex: `"0x" + handle.toString(16).padStart(64, "0")`
- Call `fhe.userDecrypt()` with the handle and EIP-712 signature
- Result is keyed by hex handle string

### setOperator

Before placing an order, the user must authorize VeilBook as an operator on their EncryptedERC20:

```solidity
encToken.setOperator(VeilBook, uint48(expiryTimestamp))
```

The expiry is `uint48` — pass `BigInt(timestamp)` from the frontend.

---

## Tech Stack

- Solidity
- Uniswap V4
- Zama fhEVM
- Hardhat
- ethers.js
- TypeScript
- Sepolia

---

*VeilBook — confidential DeFi, onchain.*
