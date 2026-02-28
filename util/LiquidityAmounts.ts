
const Q96 = 2n ** 96n;

/**
 * Calculates floor(a * b / denominator)
 * Note: In JS, BigInt handles arbitrary precision, so we don't 
 * need the complex overflow logic Solidity requires.
 */
function mulDiv(a: bigint | number, b: bigint | number, denominator: bigint | number): bigint {
    const result = (BigInt(a) * BigInt(b)) / BigInt(denominator);
    return result;
}

/**
/**
 * Validates uint128 overflow
 */
function toUint128(x: bigint | number): bigint {
    const value = BigInt(x);
    const uint128Max = (2n ** 128n) - 1n;
    if (value < 0n || value > uint128Max) throw new Error("Liquidity overflow");
    return value;
}

const MIN_TICK = -887272;
const MAX_TICK = 887272;

export const getTickAtSqrtRatio = (sqrtPriceX96: any) => {
    const Q96 = 2n ** 96n;
    
    // Convert sqrtPriceX96 to a floating point ratio (Price = (sqrtPrice / 2^96)^2)
    // We use Number() for the log calculation, which is safe for standard price ranges
    const ratio = Number(sqrtPriceX96) / Number(Q96);
    const price = ratio ** 2;

    // The formula: price = 1.0001 ^ tick
    // Therefore: tick = log(price) / log(1.0001)
    let tick = Math.floor(Math.log(price) / Math.log(1.0001));

    return tick;
}

/**
 * Replicates TickMath.getSqrtRatioAtTick from Solidity
 * Calculates sqrt(1.0001^tick) * 2^96
 */
export const getSqrtRatioAtTick = (tick: number): bigint => {
    const absTick = tick < 0 ? -tick : tick;
    if (absTick > MAX_TICK) throw new Error("TICK_OUT_OF_BOUNDS");

    let ratio = (absTick & 0x1) !== 0 
        ? 0xfffcb933bd6fad37aa2d162d1a594001n 
        : 0x100000000000000000000000000000000n;

    if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
    if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
    if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
    if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
    if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
    if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a0c84398c2f28f4d016n) >> 128n;
    if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c303en) >> 128n;
    if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe8617e00e45d2d8697f5368c5af91n) >> 128n;
    if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf9b1ec5158c3f6b694297376361a998n) >> 128n;
    if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf39105470000e39c4263f45f271100dn) >> 128n;
    if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7d919727760027f99990b79040adbn) >> 128n;
    if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd1a054593f6603a11000000000000000n) >> 128n;
    if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xab59546059d4360e0000000000000000n) >> 128n;
    if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x73299285090547020000000000000000n) >> 128n;
    if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x33f28d8480373e910000000000000000n) >> 128n;
    if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x0a666996846ca68d0000000000000000n) >> 128n;
    if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x006c64188b0305a40000000000000000n) >> 128n;
    if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x00002d2d9b2e88a30000000000000000n) >> 128n;
    if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x0000000007fe8f070000000000000000n) >> 128n;

    if (tick > 0) ratio = (BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / ratio);

    // Final result is Q64.96
    return (ratio >> 32n);
}


export const LiquidityAmounts = {
    getLiquidityForAmount0(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount0: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const amt0 = BigInt(amount0);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];
        
        const intermediate = mulDiv(priceA, priceB, Q96);
        return toUint128(mulDiv(amt0, intermediate, priceB - priceA));
    },

    getLiquidityForAmount1(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount1: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const amt1 = BigInt(amount1);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];
        
        return toUint128(mulDiv(amt1, Q96, priceB - priceA));
    },

    getAmountsForLiquidity(
        sqrtPriceX96: bigint | number,
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceX = BigInt(sqrtPriceX96);
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        // Standardize range: priceA must be the lower price
        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        let amount0 = 0n;
        let amount1 = 0n;

        if (priceX <= priceA) {
            // Case 1: Price is below the range (Position is 100% Token 0)
            amount0 = this.getAmount0ForLiquidity(priceA, priceB, liq);
        } else if (priceX < priceB) {
            // Case 2: Price is inside the range (Position is a mix of both tokens)
            amount0 = this.getAmount0ForLiquidity(priceX, priceB, liq);
            amount1 = this.getAmount1ForLiquidity(priceA, priceX, liq);
        } else {
            // Case 3: Price is above the range (Position is 100% Token 1)
            amount1 = this.getAmount1ForLiquidity(priceA, priceB, liq);
        }

        return [amount0, amount1];
    },

    getLiquidityForAmounts(
        sqrtPriceX96: bigint | number,
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount0: bigint | number,
        amount1: bigint | number
    ) {
        let priceX = BigInt(sqrtPriceX96);
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        if (priceX <= priceA) {
            return this.getLiquidityForAmount0(priceA, priceB, amount0);
        } else if (priceX < priceB) {
            const liquidity0 = this.getLiquidityForAmount0(priceX, priceB, amount0);
            const liquidity1 = this.getLiquidityForAmount1(priceA, priceX, amount1);
            return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            return this.getLiquidityForAmount1(priceA, priceB, amount1);
        }
    },

    getAmount0ForLiquidity(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        // Solidity: (uint256(liquidity) << 96) * (priceB - priceA) / priceB / priceA
        return mulDiv(liq << 96n, priceB - priceA, priceB) / priceA;
    },

    getAmount1ForLiquidity(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        return mulDiv(liq, priceB - priceA, Q96);
    }
};