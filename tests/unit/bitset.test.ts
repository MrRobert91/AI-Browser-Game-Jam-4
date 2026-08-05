import { describe, expect, it } from 'vitest';

import {
  assignMask,
  clearBit,
  createEmptyMask,
  createFullMask,
  hasBit,
  intersectInto,
  isEmpty,
  isSingleton,
  masksEqual,
  nextSetBit,
  popcount,
  setBit,
  singletonIndex,
  unionInto,
  type MutableDomainMask,
} from '../../src/wfc/bitset';

describe('64-bit domain masks', () => {
  it('builds every valid 0-64 variant mask exactly', () => {
    for (let variantCount = 0; variantCount <= 64; variantCount += 1) {
      const mask = createFullMask(variantCount);

      expect(popcount(mask)).toBe(variantCount);
      for (let bit = 0; bit < 64; bit += 1) {
        expect(hasBit(mask, bit)).toBe(bit < variantCount);
      }
    }
  });

  it('sets and clears every bit without replacing the mask', () => {
    const mask = createEmptyMask();

    for (let bit = 0; bit < 64; bit += 1) {
      const identity = mask;
      setBit(mask, bit);
      expect(mask).toBe(identity);
      expect(hasBit(mask, bit)).toBe(true);
    }

    expect(mask).toEqual({ lo: 0xffffffff, hi: 0xffffffff });

    for (let bit = 0; bit < 64; bit += 1) {
      const identity = mask;
      clearBit(mask, bit);
      expect(mask).toBe(identity);
      expect(hasBit(mask, bit)).toBe(false);
    }

    expect(isEmpty(mask)).toBe(true);
  });

  it('handles the signed-word boundaries 31, 32 and 63', () => {
    const mask = createEmptyMask();
    setBit(mask, 31);
    setBit(mask, 32);
    setBit(mask, 63);

    expect(mask).toEqual({ lo: 0x80000000, hi: 0x80000001 });
    expect([31, 32, 63].map((bit) => hasBit(mask, bit))).toEqual([
      true,
      true,
      true,
    ]);
    expect(popcount(mask)).toBe(3);
  });

  it('intersects, unions and assigns in place', () => {
    const target: MutableDomainMask = { lo: 0xf0f0f0f0, hi: 0xaaaaaaaa };
    const identity = target;

    expect(intersectInto(target, { lo: 0xff00ff00, hi: 0x0f0f0f0f })).toBe(
      true,
    );
    expect(target).toBe(identity);
    expect(target).toEqual({ lo: 0xf000f000, hi: 0x0a0a0a0a });
    expect(intersectInto(target, target)).toBe(false);

    expect(unionInto(target, { lo: 0x0000000f, hi: 0xf0000000 })).toBe(true);
    expect(target).toBe(identity);
    expect(target).toEqual({ lo: 0xf000f00f, hi: 0xfa0a0a0a });
    expect(unionInto(target, target)).toBe(false);

    assignMask(target, { lo: 0xffffffff, hi: 0x80000000 });
    expect(target).toBe(identity);
    expect(masksEqual(target, { lo: 0xffffffff, hi: 0x80000000 })).toBe(true);
  });

  it('detects every singleton and returns its index', () => {
    const mask = createEmptyMask();
    expect(isSingleton(mask)).toBe(false);
    expect(singletonIndex(mask)).toBeNull();

    for (let bit = 0; bit < 64; bit += 1) {
      setBit(mask, bit);
      expect(isSingleton(mask)).toBe(true);
      expect(singletonIndex(mask)).toBe(bit);
      clearBit(mask, bit);
    }

    setBit(mask, 0);
    setBit(mask, 63);
    expect(isSingleton(mask)).toBe(false);
    expect(singletonIndex(mask)).toBeNull();
  });

  it('iterates sparse bits without allocating a collection', () => {
    const mask = createEmptyMask();
    const expected = [0, 1, 31, 32, 47, 63];
    for (const bit of expected) {
      setBit(mask, bit);
    }

    const visited: number[] = [];
    for (
      let bit = nextSetBit(mask);
      bit !== -1;
      bit = nextSetBit(mask, bit + 1)
    ) {
      visited.push(bit);
    }

    expect(visited).toEqual(expected);
    expect(nextSetBit(mask, 64)).toBe(-1);
  });

  it('rejects invalid counts, indices and iteration starts', () => {
    for (const count of [-1, 65, 1.5, Number.NaN]) {
      expect(() => createFullMask(count)).toThrow(RangeError);
    }

    const mask = createEmptyMask();
    for (const bit of [-1, 64, 2.5, Number.NaN]) {
      expect(() => setBit(mask, bit)).toThrow(RangeError);
      expect(() => clearBit(mask, bit)).toThrow(RangeError);
      expect(() => hasBit(mask, bit)).toThrow(RangeError);
    }

    for (const fromIndex of [-1, 65, 2.5, Number.NaN]) {
      expect(() => nextSetBit(mask, fromIndex)).toThrow(RangeError);
    }
  });
});
