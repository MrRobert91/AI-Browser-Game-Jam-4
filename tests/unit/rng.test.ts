import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createRng,
  deriveSeed,
  hashFinalWorld,
  nextFloat01,
  nextUint32,
  simulationTickAt,
} from '../../src/wfc/rng';

describe('deterministic PRNG and seed derivation', () => {
  it('matches fixed Mulberry32 vectors for representative seeds', () => {
    const zeroSeed = createRng(0);
    expect(Array.from({ length: 5 }, () => nextUint32(zeroSeed))).toEqual([
      1_144_304_738, 1_416_247, 958_946_056, 627_933_444, 2_007_157_716,
    ]);

    const maxSeed = createRng(0xffffffff);
    expect(Array.from({ length: 3 }, () => nextUint32(maxSeed))).toEqual([
      3_850_105_811, 813_802_916, 3_073_704_848,
    ]);
  });

  it('preserves stream state and produces floats inside the half-open range', () => {
    const state = createRng(0x12345678);
    const identity = state;
    const values = Array.from({ length: 128 }, () => nextFloat01(state));

    expect(state).toBe(identity);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it('derives stable, separated streams by system and signed chunk', () => {
    expect(deriveSeed(0xa91f42c0, 'terrain', 2, -3)).toBe(1_907_926_411);
    expect(deriveSeed(0xa91f42c0, 'terrain', 2, -3)).toBe(
      deriveSeed(0xa91f42c0, 'terrain', 2, -3),
    );

    const seeds = new Set([
      deriveSeed(0xa91f42c0, 'terrain', 2, -3),
      deriveSeed(0xa91f42c0, 'feature', 2, -3),
      deriveSeed(0xa91f42c0, 'terrain', 3, -3),
      deriveSeed(0xa91f42c0, 'terrain', 2, -2),
      deriveSeed(0xa91f42c1, 'terrain', 2, -3),
    ]);
    expect(seeds.size).toBe(5);
  });

  it('rejects seeds and chunk coordinates outside their integer domains', () => {
    expect(() => createRng(-1)).toThrow(RangeError);
    expect(() => createRng(0x1_0000_0000)).toThrow(RangeError);
    expect(() => deriveSeed(0, 'terrain', 0x8000_0000, 0)).toThrow(RangeError);
    expect(() => deriveSeed(0, 'terrain', 0, -0x8000_0001)).toThrow(RangeError);
  });

  it('keeps ambient randomness out of the solver implementation', async () => {
    const violations: string[] = [];
    for (const file of await typescriptFiles(resolve('src/wfc'))) {
      if ((await readFile(file, 'utf8')).includes('Math.random')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('fixed 10 Hz simulation clock', () => {
  it('maps exact and floating-point boundaries to complete ticks', () => {
    expect(simulationTickAt(0)).toBe(0);
    expect(simulationTickAt(99.999)).toBe(0);
    expect(simulationTickAt(100)).toBe(1);
    expect(simulationTickAt(300.00000000000006)).toBe(3);
    expect(simulationTickAt(999.999)).toBe(9);
    expect(simulationTickAt(1_000)).toBe(10);
  });

  it('emits the same PRNG sequence at different render framerates', () => {
    expect(sequenceAtFrameRate(30, 2_000)).toEqual(
      sequenceAtFrameRate(60, 2_000),
    );
    expect(sequenceAtFrameRate(60, 2_000)).toEqual(
      sequenceAtFrameRate(144, 2_000),
    );
    expect(sequenceAtFrameRate(144, 2_000)).toHaveLength(20);
  });
});

describe('canonical final world hash', () => {
  const fixedCells = [
    { cellId: 65, terrainTileId: 4, featureTileId: null },
    { cellId: 1, terrainTileId: 2, featureTileId: 7 },
    { cellId: 4095, terrainTileId: 9, featureTileId: 0 },
  ] as const;

  it('matches a fixed vector and ignores insertion order', () => {
    const expected = 3_069_527_348;
    expect(hashFinalWorld(0xa91f42c0, fixedCells)).toBe(expected);
    expect(hashFinalWorld(0xa91f42c0, [...fixedCells].reverse())).toBe(
      expected,
    );
  });

  it('changes when seed, terrain, feature presence or feature id changes', () => {
    const baseline = hashFinalWorld(7, fixedCells);
    const variants = [
      hashFinalWorld(8, fixedCells),
      hashFinalWorld(7, [
        fixedCells[0],
        { ...fixedCells[1], terrainTileId: 3 },
        fixedCells[2],
      ]),
      hashFinalWorld(7, [
        fixedCells[0],
        { ...fixedCells[1], featureTileId: null },
        fixedCells[2],
      ]),
      hashFinalWorld(7, [
        fixedCells[0],
        { ...fixedCells[1], featureTileId: 8 },
        fixedCells[2],
      ]),
    ];

    expect(variants.every((value) => value !== baseline)).toBe(true);
  });

  it('rejects duplicate cells and invalid numeric boundaries', () => {
    expect(() =>
      hashFinalWorld(0, [fixedCells[0], { ...fixedCells[0] }]),
    ).toThrow(RangeError);
    expect(() => hashFinalWorld(-1, fixedCells)).toThrow(RangeError);
    expect(() =>
      hashFinalWorld(0, [
        { cellId: 0x1_0000_0000, terrainTileId: 0, featureTileId: null },
      ]),
    ).toThrow(RangeError);
  });
});

function sequenceAtFrameRate(frameRate: number, durationMs: number): number[] {
  const state = createRng(0x5eed1234);
  const sequence: number[] = [];
  let previousTick = 0;

  for (let frame = 1; ; frame += 1) {
    const elapsedMs = Math.min((frame * 1_000) / frameRate, durationMs);
    const currentTick = simulationTickAt(elapsedMs);
    while (previousTick < currentTick) {
      sequence.push(nextUint32(state));
      previousTick += 1;
    }

    if (elapsedMs === durationMs) {
      return sequence;
    }
  }
}

async function typescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return typescriptFiles(path);
      return extname(path) === '.ts' ? [path] : [];
    }),
  );
  return files.flat();
}
