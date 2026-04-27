// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.27;

// import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
// import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
// import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
// import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
// import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
// import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
// import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
// import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
// import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";

// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// import {FHE, externalEuint256, euint256, ebool} from "@fhevm/solidity/lib/FHE.sol";
// import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";


// interface IConfidentialERC20 {
//     function transferFrom(address from, address to, euint256 amount) external;
//     function transfer(address to, euint256 amount) external;
// }


// contract EmelBid is
//     BaseHook,
//     ReentrancyGuard,
//     GatewayContract,
//     ZamaEthereumConfig,
//     ZamaGatewayConfig
// {
//     using SafeERC20 for IERC20;
//     using PoolIdLibrary for PoolKey;
//     using CurrencyLibrary for Currency;

//     // =========================================================================
//     //                               TYPES
//     // =========================================================================

//     enum AssetType { ERC20, ERC721, CONFIDENTIAL }

//     /// @dev Stored once per auction (per PoolId)
//     struct AuctionConfig {
//         // ── seller info ──────────────────────────────────────────────────────
//         address seller;

//         // ── public reference price (bidders use this as anchor) ──────────────
//         uint256 publicStartPrice;   // plaintext, shown on frontend

//         // ── encrypted price curve ────────────────────────────────────────────
//         euint256 encStartPrice;     // real starting price (hidden)
//         euint256 encDecayRate;      // price drop per block (hidden)
//         euint256 encReserve;        // floor / reserve price (hidden)

//         // ── timing ───────────────────────────────────────────────────────────
//         uint256 startBlock;         // block.number + 2 at creation
//         uint256 duration;           // auction length in blocks

//         // ── asset being auctioned ────────────────────────────────────────────
//         AssetType assetType;
//         address asset;              // ERC20 / ERC721 / ConfidentialERC20 address
//         uint256 tokenIdOrAmount;    // tokenId for ERC721, amount for ERC20

//         // ── state ────────────────────────────────────────────────────────────
//         bool settled;
//     }

//     /// @dev One entry per pending gateway decryption request
//     struct PendingBid {
//         address bidder;
//         euint256 encBid;    // WETH bid — held by hook until settlement
//         PoolId poolId;
//         bool exists;
//     }

//     // =========================================================================
//     //                           STATE VARIABLES
//     // =========================================================================

//     /// @notice poolId → auction config
//     mapping(PoolId => AuctionConfig) public auctions;

//     /// @notice gatewayRequestId → pending bid
//     mapping(uint256 => PendingBid) public pendingBids;

//     /// @notice seller address → number of auctions created (used as CREATE2 salt nonce)
//     mapping(address => uint256) public sellerNonce;

//     /// @notice WETH contract used for all bid payments
//     IERC20 public immutable WETH;

//     // sqrtPrice representing 1:1 ratio — used for pool initialisation (price irrelevant)
//     uint160 private constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

//     // =========================================================================
//     //                                EVENTS
//     // =========================================================================

//     event AuctionCreated(
//         PoolId indexed poolId,
//         address indexed seller,
//         uint256 publicStartPrice,
//         uint256 startBlock,
//         uint256 duration,
//         AssetType assetType
//     );

//     event BidSubmitted(
//         PoolId indexed poolId,
//         address indexed bidder,
//         uint256 requestId
//     );

//     event AuctionSettled(
//         PoolId indexed poolId,
//         address indexed winner
//     );

//     event BidRefunded(
//         PoolId indexed poolId,
//         address indexed bidder
//     );

//     event AuctionExpired(PoolId indexed poolId);

//     // =========================================================================
//     //                                ERRORS
//     // =========================================================================

//     error AuctionNotFound();
//     error AuctionNotStarted();
//     error AuctionEnded();
//     error AuctionAlreadySettled();
//     error InvalidBid();
//     error OnlyGateway();
//     error AssetTransferFailed();
//     error InvalidDuration();
//     error InvalidPublicStartPrice();

//     // =========================================================================
//     //                             CONSTRUCTOR
//     // =========================================================================

//     constructor(IPoolManager _poolManager, address _weth)
//         BaseHook(_poolManager)
//     {
//         WETH = IERC20(_weth);
//     }

//     // =========================================================================
//     //                         HOOK PERMISSIONS
//     // =========================================================================

//     function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
//         return Hooks.Permissions({
//             beforeInitialize:              false,
//             afterInitialize:               true,   // store auction config
//             beforeAddLiquidity:            false,
//             afterAddLiquidity:             false,
//             beforeRemoveLiquidity:         false,
//             afterRemoveLiquidity:          false,
//             beforeSwap:                    true,   // intercept bid, pull WETH, FHE compare
//             afterSwap:                     true,   // request gateway decryption
//             beforeDonate:                  false,
//             afterDonate:                   false,
//             beforeSwapReturnDelta:         false,
//             afterSwapReturnDelta:          false,
//             afterAddLiquidityReturnDelta:  false,
//             afterRemoveLiquidityReturnDelta: false
//         });
//     }

//     // =========================================================================
//     //                        AUCTION CREATION
//     // =========================================================================

//     /**
//      * @notice Create a new encrypted Dutch auction.
//      *
//      * @dev Deploys a unique AuctionSlot token via CREATE2, initialises a
//      *      Uniswap V4 pool (WETH / AuctionSlot) with this hook, and stores
//      *      encrypted auction params inside afterInitialize.
//      *
//      * @param publicStartPrice   Plaintext anchor price shown to bidders
//      * @param encStartPrice      Encrypted real starting price (fhEVM input)
//      * @param encDecayRate       Encrypted price decay per block (fhEVM input)
//      * @param encReserve         Encrypted reserve / floor price (fhEVM input)
//      * @param inputProof         ZK proof for the three encrypted inputs
//      * @param duration           Auction length in blocks
//      * @param assetType          ERC20 | ERC721 | CONFIDENTIAL
//      * @param asset              Address of the asset contract
//      * @param tokenIdOrAmount    tokenId (ERC721) or amount (ERC20/CONFIDENTIAL)
//      */
//     function createAuction(
//         uint256 publicStartPrice,
//         externalEuint256 encStartPrice,
//         externalEuint256 encDecayRate,
//         externalEuint256 encReserve,
//         bytes calldata inputProof,
//         uint256 duration,
//         AssetType assetType,
//         address asset,
//         uint256 tokenIdOrAmount
//     ) external nonReentrant {
//         if (publicStartPrice == 0)  revert InvalidPublicStartPrice();
//         if (duration == 0)          revert InvalidDuration();

//         // ── pull asset into hook custody before pool creation ─────────────────
//         _receiveAsset(assetType, asset, tokenIdOrAmount, msg.sender);

//         // ── deploy unique AuctionSlot for token1 via CREATE2 ──────────────────
//         address auctionSlot = _deployAuctionSlot(msg.sender, sellerNonce[msg.sender]++);

//         // ── V4 requires currency0 < currency1 ─────────────────────────────────
//         (Currency c0, Currency c1) = address(WETH) < auctionSlot
//             ? (Currency.wrap(address(WETH)), Currency.wrap(auctionSlot))
//             : (Currency.wrap(auctionSlot),   Currency.wrap(address(WETH)));

//         PoolKey memory key = PoolKey({
//             currency0: c0,
//             currency1: c1,
//             fee:         0,
//             tickSpacing: 60,
//             hooks:       IHooks(address(this))
//         });

//         // ── encode params for afterInitialize ─────────────────────────────────
//         bytes memory hookData = abi.encode(
//             msg.sender,
//             publicStartPrice,
//             encStartPrice,
//             encDecayRate,
//             encReserve,
//             inputProof,
//             duration,
//             assetType,
//             asset,
//             tokenIdOrAmount
//         );

//         // ── initialise pool — afterInitialize fires immediately ───────────────
//         poolManager.initialize(key, SQRT_PRICE_1_1, hookData);
//     }

//     // =========================================================================
//     //                          HOOK: afterInitialize
//     // =========================================================================

//     function _afterInitialize(
//         address,
//         PoolKey calldata key,
//         uint160,
//         int24,
//         bytes calldata hookData
//     ) internal override returns (bytes4) {

//         (
//             address seller,
//             uint256 publicStartPrice,
//             externalEuint256 encStartPriceExt,
//             externalEuint256 encDecayRateExt,
//             externalEuint256 encReserveExt,
//             bytes memory inputProof,
//             uint256 duration,
//             AssetType assetType,
//             address asset,
//             uint256 tokenIdOrAmount
//         ) = abi.decode(hookData, (
//             address, uint256,
//             externalEuint256, externalEuint256, externalEuint256,
//             bytes,
//             uint256, AssetType, address, uint256
//         ));

//         // Convert external encrypted inputs to internal handles
//         euint256 encStart   = FHE.fromExternal(encStartPriceExt, inputProof);
//         euint256 encDecay   = FHE.fromExternal(encDecayRateExt,  inputProof);
//         euint256 encReserve = FHE.fromExternal(encReserveExt,    inputProof);

//         // Grant hook persistent access to the ciphertexts
//         FHE.allowThis(encStart);
//         FHE.allowThis(encDecay);
//         FHE.allowThis(encReserve);

//         PoolId id = key.toId();

//         auctions[id] = AuctionConfig({
//             seller:           seller,
//             publicStartPrice: publicStartPrice,
//             encStartPrice:    encStart,
//             encDecayRate:     encDecay,
//             encReserve:       encReserve,
//             startBlock:       block.number + 2,  // 2-block safety buffer
//             duration:         duration,
//             assetType:        assetType,
//             asset:            asset,
//             tokenIdOrAmount:  tokenIdOrAmount,
//             settled:          false
//         });

//         emit AuctionCreated(id, seller, publicStartPrice, block.number + 2, duration, assetType);

//         return BaseHook.afterInitialize.selector;
//     }

//     // =========================================================================
//     //                          HOOK: beforeSwap  (BID)
//     // =========================================================================

//     /**
//      * @notice Intercepts every swap on an auction pool.
//      *
//      *  Flow:
//      *    1. Validate auction is active
//      *    2. Decode (encBid, proof) from hookData
//      *    3. Pull WETH from bidder via operator approval (set on frontend)
//      *    4. Compute homomorphic current price
//      *    5. FHE comparison: encBid >= encCurrentPrice?
//      *    6. Store pending bid against a request ID
//      *    7. Zero amountSpecified so PoolManager moves nothing
//      */
//     function _beforeSwap(
//         address sender,
//         PoolKey calldata key,
//         SwapParams calldata,
//         bytes calldata hookData
//     ) internal override returns (bytes4, BeforeSwapDelta, uint24) {

//         PoolId id = key.toId();
//         AuctionConfig storage auction = auctions[id];

//         // ── guards ────────────────────────────────────────────────────────────
//         if (auction.seller == address(0))              revert AuctionNotFound();
//         if (block.number < auction.startBlock)         revert AuctionNotStarted();
//         if (block.number > auction.startBlock + auction.duration) revert AuctionEnded();
//         if (auction.settled)                           revert AuctionAlreadySettled();

//         // ── decode encrypted bid from hookData ────────────────────────────────
//         (externalEuint256 encBidExt, bytes memory proof) =
//             abi.decode(hookData, (externalEuint256, bytes));

//         euint256 encBid = FHE.fromExternal(encBidExt, proof);
//         FHE.allowThis(encBid);

//         // ── pull WETH from bidder using operator approval ─────────────────────
//         // Frontend must call WETH.approve(hookAddress, amount) or
//         // setOperator(hookAddress) before swap
//         WETH.safeTransferFrom(sender, address(this), 0); 
//         // NOTE: amount is encrypted so we use confidential transferFrom below
//         // Bidder sets hook as operator on the confidential WETH (fhEVM pattern)
//         // FHE.transferFrom is used here — bidder must have set operator on frontend
//         // This transfers encBid worth of WETH into hook custody
//         _pullEncryptedWETH(sender, encBid);

//         // ── compute current auction price homomorphically ─────────────────────
//         euint256 currentPrice = _currentEncPrice(auction);

//         // ── FHE comparison: does bid meet or beat current price? ──────────────
//         ebool isWinning = FHE.ge(encBid, currentPrice);
//         FHE.allowThis(isWinning);

//         // ── request gateway decryption — callback fires in a separate tx ──────
//         uint256[] memory cts = new uint256[](1);
//         cts[0] = Gateway.toUint256(isWinning);
//         FHE.allowTransient(isWinning, address(Gateway));

//         uint256 requestId = Gateway.requestDecryption(
//             cts,
//             this.decryptionCallback.selector,
//             0,
//             block.timestamp + 100,
//             false
//         );

//         // ── store bid info for callback ───────────────────────────────────────
//         pendingBids[requestId] = PendingBid({
//             bidder:  sender,
//             encBid:  encBid,
//             poolId:  id,
//             exists:  true
//         });

//         emit BidSubmitted(id, sender, requestId);

//         // ── return zero delta — pool moves nothing ────────────────────────────
//         return (
//             BaseHook.beforeSwap.selector,
//             BeforeSwapDeltaLibrary.ZERO_DELTA,
//             0
//         );
//     }

//     // =========================================================================
//     //                          HOOK: afterSwap
//     // =========================================================================

//     /**
//      * @notice Fires after every swap. Used only for event emission here —
//      *  the heavy lifting (decryption + settlement) happens in the gateway callback.
//      */
//     function _afterSwap(
//         address,
//         PoolKey calldata key,
//         SwapParams calldata,
//         BalanceDelta,
//         bytes calldata
//     ) internal override returns (bytes4, int128) {
//         // Gateway decryption request was already made in beforeSwap.
//         // Nothing else needed here — settlement happens in decryptionCallback.
//         return (BaseHook.afterSwap.selector, 0);
//     }

//     // =========================================================================
//     //                      GATEWAY DECRYPTION CALLBACK
//     // =========================================================================

//     /**
//      * @notice Called automatically by the Zama gateway once isWinning is decrypted.
//      *
//      *  Winner → asset transferred to bidder, WETH kept by hook (goes to seller).
//      *  Loser  → WETH refunded to bidder, auction continues.
//      *
//      * @param requestId   Gateway request ID (maps to pending bid)
//      * @param isWinning   Decrypted result of FHE.ge(encBid, currentPrice)
//      */
//     function decryptionCallback(
//         uint256 requestId,
//         bool isWinning
//     ) external onlyGateway returns (bool) {

//         PendingBid storage bid = pendingBids[requestId];
//         require(bid.exists, "Unknown request");

//         AuctionConfig storage auction = auctions[bid.poolId];

//         if (isWinning && !auction.settled) {
//             // ── WINNER ────────────────────────────────────────────────────────
//             auction.settled = true;

//             _sendAssetToWinner(auction, bid.bidder);

//             // WETH stays in hook — seller can withdraw via withdrawProceeds()
//             emit AuctionSettled(bid.poolId, bid.bidder);

//         } else {
//             // ── LOSER — refund encrypted WETH ─────────────────────────────────
//             // If auction is already settled, this bid also loses
//             _refundEncryptedWETH(bid.bidder, bid.encBid);

//             emit BidRefunded(bid.poolId, bid.bidder);
//         }

//         delete pendingBids[requestId];
//         return true;
//     }

//     // =========================================================================
//     //                        SELLER: WITHDRAW PROCEEDS
//     // =========================================================================

//     /**
//      * @notice Seller calls this after auction settles to claim WETH proceeds.
//      * @dev    Amount is kept as encrypted WETH in hook — seller receives it here.
//      */
//     function withdrawProceeds(PoolId poolId) external nonReentrant {
//         AuctionConfig storage auction = auctions[poolId];
//         require(auction.seller == msg.sender, "Not seller");
//         require(auction.settled, "Not settled");

//         // Transfer proceeds to seller
//         // In production this would track encWETH balance per auction
//         // For now emitting event — full implementation tracks per-auction proceeds
//         // TODO: track encWETHProceeds[poolId] and transfer here
//     }

//     // =========================================================================
//     //                           EXPIRE AUCTION
//     // =========================================================================

//     /**
//      * @notice Anyone can call this after auction duration passes with no winner.
//      *         Returns asset to seller.
//      */
//     function expireAuction(PoolId poolId) external nonReentrant {
//         AuctionConfig storage auction = auctions[poolId];
//         if (auction.seller == address(0))   revert AuctionNotFound();
//         if (auction.settled)                revert AuctionAlreadySettled();
//         require(
//             block.number > auction.startBlock + auction.duration,
//             "Auction still active"
//         );

//         auction.settled = true;

//         // Return asset to seller
//         _sendAssetToWinner(auction, auction.seller);

//         emit AuctionExpired(poolId);
//     }

//     // =========================================================================
//     //                          INTERNAL HELPERS
//     // =========================================================================

//     /**
//      * @notice Compute current encrypted auction price.
//      *  currentPrice = max(encStartPrice - (encDecayRate * blocksElapsed), encReserve)
//      */
//     function _currentEncPrice(
//         AuctionConfig storage auction
//     ) internal view returns (euint256) {

//         uint256 blocksElapsed = block.number - auction.startBlock;

//         euint256 decayed = FHE.mul(
//             auction.encDecayRate,
//             FHE.asEuint256(blocksElapsed)
//         );

//         euint256 price = FHE.sub(auction.encStartPrice, decayed);

//         // Clamp at reserve floor
//         return FHE.max(price, auction.encReserve);
//     }

//     /**
//      * @notice Pull encrypted WETH from bidder using operator approval.
//      *  Bidder must call setOperator(hookAddress) on the confidential WETH
//      *  contract from the frontend before calling swap().
//      */
//     function _pullEncryptedWETH(address from, euint256 encAmount) internal {
//         // Uses fhEVM confidential transferFrom — operator must be set
//         FHE.allowTransient(encAmount, address(WETH));
//         IConfidentialERC20(address(WETH)).transferFrom(from, address(this), encAmount);
//     }

//     /**
//      * @notice Refund encrypted WETH to a losing bidder.
//      */
//     function _refundEncryptedWETH(address to, euint256 encAmount) internal {
//         FHE.allow(encAmount, to);
//         IConfidentialERC20(address(WETH)).transfer(to, encAmount);
//     }

//     /**
//      * @notice Transfer the auctioned asset to the winner (or back to seller on expiry).
//      */
//     function _sendAssetToWinner(
//         AuctionConfig storage auction,
//         address recipient
//     ) internal {
//         if (auction.assetType == AssetType.ERC721) {
//             // Single NFT transfer
//             IERC721(auction.asset).transferFrom(
//                 address(this),
//                 recipient,
//                 auction.tokenIdOrAmount   // tokenId
//             );

//         } else if (auction.assetType == AssetType.ERC20) {
//             // Fungible token transfer
//             IERC20(auction.asset).safeTransfer(
//                 recipient,
//                 auction.tokenIdOrAmount   // amount
//             );

//         } else {
//             // Confidential ERC-20 (ERC-7984)
//             // Hook must have been granted operator access when seller deposited
//             IConfidentialERC20(auction.asset).transfer(
//                 recipient,
//                 FHE.asEuint256(auction.tokenIdOrAmount)  // encrypted amount
//             );
//         }
//     }

//     /**
//      * @notice Pull auctioned asset from seller into hook custody at auction creation.
//      */
//     function _receiveAsset(
//         AssetType assetType,
//         address asset,
//         uint256 tokenIdOrAmount,
//         address seller
//     ) internal {
//         if (assetType == AssetType.ERC721) {
//             IERC721(asset).transferFrom(seller, address(this), tokenIdOrAmount);

//         } else if (assetType == AssetType.ERC20) {
//             IERC20(asset).safeTransferFrom(seller, address(this), tokenIdOrAmount);

//         } else {
//             // Confidential ERC-20 — seller must set hook as operator on frontend
//             IConfidentialERC20(asset).transferFrom(
//                 seller,
//                 address(this),
//                 FHE.asEuint256(tokenIdOrAmount)
//             );
//         }
//     }

//     // =========================================================================
//     //                         CREATE2 — AuctionSlot
//     // =========================================================================

//     /**
//      * @notice Deploy a minimal ERC-20 via CREATE2 to serve as token1 for the pool.
//      *  Purely structural — gives each auction a unique PoolId.
//      */
//     function _deployAuctionSlot(
//         address seller,
//         uint256 nonce
//     ) internal returns (address deployed) {

//         bytes32 salt = keccak256(abi.encodePacked(seller, nonce));

//         bytes memory bytecode = abi.encodePacked(
//             type(AuctionSlot).creationCode,
//             abi.encode("AuctionSlot")
//         );

//         assembly {
//             deployed := create2(
//                 0,
//                 add(bytecode, 0x20),
//                 mload(bytecode),
//                 salt
//             )
//         }

//         require(deployed != address(0), "AuctionSlot deployment failed");
//     }

//     /**
//      * @notice Predict the AuctionSlot address before deploying.
//      *  Useful for frontend to compute PoolId ahead of the transaction.
//      */
//     function predictAuctionSlot(
//         address seller,
//         uint256 nonce
//     ) external view returns (address) {

//         bytes32 salt = keccak256(abi.encodePacked(seller, nonce));

//         bytes32 bytecodeHash = keccak256(abi.encodePacked(
//             type(AuctionSlot).creationCode,
//             abi.encode("AuctionSlot")
//         ));

//         return address(uint160(uint256(keccak256(abi.encodePacked(
//             bytes1(0xff),
//             address(this),
//             salt,
//             bytecodeHash
//         )))));
//     }

//     // =========================================================================
//     //                           GATEWAY MODIFIER
//     // =========================================================================

//     modifier onlyGateway() {
//         if (msg.sender != address(Gateway)) revert OnlyGateway();
//         _;
//     }

//     // =========================================================================
//     //                             VIEW FUNCTIONS
//     // =========================================================================

//     function getAuction(PoolId poolId) external view returns (AuctionConfig memory) {
//         return auctions[poolId];
//     }

//     function isAuctionActive(PoolId poolId) external view returns (bool) {
//         AuctionConfig storage a = auctions[poolId];
//         return (
//             !a.settled &&
//             block.number >= a.startBlock &&
//             block.number <= a.startBlock + a.duration
//         );
//     }

//     function blocksRemaining(PoolId poolId) external view returns (uint256) {
//         AuctionConfig storage a = auctions[poolId];
//         uint256 endBlock = a.startBlock + a.duration;
//         if (block.number >= endBlock) return 0;
//         return endBlock - block.number;
//     }

//     receive() external payable {}
// }

