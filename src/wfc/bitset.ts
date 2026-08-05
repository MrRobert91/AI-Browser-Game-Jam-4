import type { DomainMask } from '../contracts/world';

export const DOMAIN_CAPACITY = 64;

const WORD_BITS = 32;
const UINT32_MASK = 0xffffffff;

/** Mutable solver-owned representation; read-only consumers use DomainMask. */
export interface MutableDomainMask extends DomainMask {
  lo: number;
  hi: number;
}

/** Setup-only allocation for an empty domain. Hot operations mutate this object. */
export function createEmptyMask(): MutableDomainMask {
  return { lo: 0, hi: 0 };
}

/** Setup-only allocation containing the first variantCount bits. */
export function createFullMask(variantCount: number): MutableDomainMask {
  assertVariantCount(variantCount);

  if (variantCount <= WORD_BITS) {
    return { lo: lowerBits(variantCount), hi: 0 };
  }

  return {
    lo: UINT32_MASK,
    hi: lowerBits(variantCount - WORD_BITS),
  };
}

export function assignMask(
  target: MutableDomainMask,
  source: DomainMask,
): void {
  target.lo = source.lo >>> 0;
  target.hi = source.hi >>> 0;
}

export function setBit(mask: MutableDomainMask, bitIndex: number): void {
  assertBitIndex(bitIndex);

  if (bitIndex < WORD_BITS) {
    mask.lo = (mask.lo | (1 << bitIndex)) >>> 0;
    return;
  }

  mask.hi = (mask.hi | (1 << (bitIndex - WORD_BITS))) >>> 0;
}

export function clearBit(mask: MutableDomainMask, bitIndex: number): void {
  assertBitIndex(bitIndex);

  if (bitIndex < WORD_BITS) {
    mask.lo = (mask.lo & ~(1 << bitIndex)) >>> 0;
    return;
  }

  mask.hi = (mask.hi & ~(1 << (bitIndex - WORD_BITS))) >>> 0;
}

export function hasBit(mask: DomainMask, bitIndex: number): boolean {
  assertBitIndex(bitIndex);

  if (bitIndex < WORD_BITS) {
    return ((mask.lo >>> bitIndex) & 1) === 1;
  }

  return ((mask.hi >>> (bitIndex - WORD_BITS)) & 1) === 1;
}

/** Intersects target in place and reports whether either word changed. */
export function intersectInto(
  target: MutableDomainMask,
  source: DomainMask,
): boolean {
  const nextLo = (target.lo & source.lo) >>> 0;
  const nextHi = (target.hi & source.hi) >>> 0;
  const changed = nextLo !== target.lo || nextHi !== target.hi;

  target.lo = nextLo;
  target.hi = nextHi;
  return changed;
}

/** Unions source into target and reports whether either word changed. */
export function unionInto(
  target: MutableDomainMask,
  source: DomainMask,
): boolean {
  const nextLo = (target.lo | source.lo) >>> 0;
  const nextHi = (target.hi | source.hi) >>> 0;
  const changed = nextLo !== target.lo || nextHi !== target.hi;

  target.lo = nextLo;
  target.hi = nextHi;
  return changed;
}

export function masksEqual(left: DomainMask, right: DomainMask): boolean {
  return left.lo === right.lo && left.hi === right.hi;
}

export function isEmpty(mask: DomainMask): boolean {
  return mask.lo === 0 && mask.hi === 0;
}

export function popcount(mask: DomainMask): number {
  return popcount32(mask.lo) + popcount32(mask.hi);
}

export function isSingleton(mask: DomainMask): boolean {
  if (mask.lo === 0) {
    return hasSingleBit32(mask.hi);
  }

  return mask.hi === 0 && hasSingleBit32(mask.lo);
}

export function singletonIndex(mask: DomainMask): number | null {
  if (!isSingleton(mask)) {
    return null;
  }

  if (mask.lo !== 0) {
    return WORD_BITS - 1 - Math.clz32(mask.lo);
  }

  return WORD_BITS + (WORD_BITS - 1 - Math.clz32(mask.hi));
}

/**
 * Returns the first set bit at or after fromIndex, or -1. This keeps hot
 * iteration allocation-free: callers repeatedly pass the previous result + 1.
 */
export function nextSetBit(mask: DomainMask, fromIndex = 0): number {
  assertIterationIndex(fromIndex);

  if (fromIndex === DOMAIN_CAPACITY) {
    return -1;
  }

  if (fromIndex < WORD_BITS) {
    const lo = (mask.lo & (UINT32_MASK << fromIndex)) >>> 0;
    if (lo !== 0) {
      return trailingZeroCount32(lo);
    }

    if (mask.hi !== 0) {
      return WORD_BITS + trailingZeroCount32(mask.hi);
    }

    return -1;
  }

  const offset = fromIndex - WORD_BITS;
  const hi = (mask.hi & (UINT32_MASK << offset)) >>> 0;
  return hi === 0 ? -1 : WORD_BITS + trailingZeroCount32(hi);
}

function lowerBits(count: number): number {
  if (count === 0) {
    return 0;
  }

  return count === WORD_BITS ? UINT32_MASK : (2 ** count - 1) >>> 0;
}

function popcount32(value: number): number {
  let word = value >>> 0;
  word -= (word >>> 1) & 0x55555555;
  word = (word & 0x33333333) + ((word >>> 2) & 0x33333333);
  word = (word + (word >>> 4)) & 0x0f0f0f0f;
  return Math.imul(word, 0x01010101) >>> 24;
}

function hasSingleBit32(value: number): boolean {
  const word = value >>> 0;
  return word !== 0 && (word & (word - 1)) === 0;
}

function trailingZeroCount32(value: number): number {
  return WORD_BITS - 1 - Math.clz32((value & -value) >>> 0);
}

function assertVariantCount(variantCount: number): void {
  if (
    !Number.isInteger(variantCount) ||
    variantCount < 0 ||
    variantCount > DOMAIN_CAPACITY
  ) {
    throw new RangeError('variantCount must be an integer from 0 to 64');
  }
}

function assertBitIndex(bitIndex: number): void {
  if (
    !Number.isInteger(bitIndex) ||
    bitIndex < 0 ||
    bitIndex >= DOMAIN_CAPACITY
  ) {
    throw new RangeError('bitIndex must be an integer from 0 to 63');
  }
}

function assertIterationIndex(bitIndex: number): void {
  if (
    !Number.isInteger(bitIndex) ||
    bitIndex < 0 ||
    bitIndex > DOMAIN_CAPACITY
  ) {
    throw new RangeError('fromIndex must be an integer from 0 to 64');
  }
}
