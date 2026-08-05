import { describe, expect, it } from 'vitest';

import { createEmptyMask, setBit } from '../../src/wfc/bitset';
import {
  effectiveWeight,
  observationPriority,
  selectHighestPriorityCell,
  selectWeightedVariant,
  weightedEntropy,
  type ObservationPriorityCandidate,
  type WeightDefinition,
} from '../../src/wfc/entropy';
import { createRng } from '../../src/wfc/rng';

const neutralContext = {
  distanceFromOrigin: 0,
  deterministicNoise01: 0.5,
} as const;

describe('weighted entropy and effective weights', () => {
  it('matches the normative weighted Shannon formula', () => {
    const domain = createEmptyMask();
    setBit(domain, 0);
    setBit(domain, 1);

    expect(
      weightedEntropy(domain, [{ weight: 1 }, { weight: 1 }], neutralContext),
    ).toBeCloseTo(Math.log(2), 12);

    const expected = Math.log(4) - (3 * Math.log(3)) / 4;
    expect(
      weightedEntropy(domain, [{ weight: 1 }, { weight: 3 }], neutralContext),
    ).toBeCloseTo(expected, 12);
  });

  it('combines interpolated distance, neighbor, progression and noise factors', () => {
    const definition: WeightDefinition = {
      weight: 10,
      distanceCurve: [
        [0, 0.5],
        [10, 1],
        [20, 2],
      ],
      neighborBias: { forest: 2, water: 0.5 },
    };

    expect(
      effectiveWeight(definition, {
        distanceFromOrigin: 15,
        neighborTagCounts: { forest: 2, water: 1 },
        progressionMultiplier: 1.25,
        deterministicNoise01: 1,
      }),
    ).toBeCloseTo(38.25, 12);
  });

  it('applies stable per-variant noise without changing domain membership', () => {
    const domain = createEmptyMask();
    setBit(domain, 0);
    setBit(domain, 1);
    const entropy = weightedEntropy(domain, [{ weight: 1 }, { weight: 1 }], {
      distanceFromOrigin: 0,
      deterministicNoiseByVariant: [0, 1],
    });

    expect(entropy).toBeGreaterThan(0);
    expect(entropy).toBeLessThan(Math.log(2));
  });

  it('rejects non-positive enabled weights and malformed soft factors', () => {
    const domain = createEmptyMask();
    setBit(domain, 1);

    expect(() =>
      weightedEntropy(domain, [{ weight: 0 }, { weight: -1 }], neutralContext),
    ).toThrow(/weight must be a positive finite number/);
    expect(() =>
      effectiveWeight(
        { weight: 1, neighborBias: { meadow: 0 } },
        neutralContext,
      ),
    ).toThrow(/neighborBias\.meadow/);
    expect(() =>
      effectiveWeight(
        {
          weight: 1,
          distanceCurve: [
            [10, 1],
            [5, 2],
          ],
        },
        neutralContext,
      ),
    ).toThrow(/strictly increasing/);
  });
});

describe('deterministic weighted selection', () => {
  it('never lets soft bias restore a variant removed from the domain', () => {
    const domain = createEmptyMask();
    setBit(domain, 1);
    const definitions: readonly WeightDefinition[] = [
      { weight: 1, neighborBias: { forest: 1_000_000 } },
      { weight: 1 },
    ];
    const rng = createRng(123);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(
        selectWeightedVariant(
          domain,
          definitions,
          {
            ...neutralContext,
            neighborTagCounts: { forest: 4 },
          },
          rng,
        ),
      ).toBe(1);
    }
  });

  it('returns the same stable sequence for the same seed and domain order', () => {
    const domain = createEmptyMask();
    setBit(domain, 0);
    setBit(domain, 2);
    setBit(domain, 3);
    const definitions = [
      { weight: 1 },
      { weight: 1000 },
      { weight: 2 },
      { weight: 3 },
    ];
    const left = createRng(0xa91f42c0);
    const right = createRng(0xa91f42c0);

    const leftSequence = Array.from({ length: 20 }, () =>
      selectWeightedVariant(domain, definitions, neutralContext, left),
    );
    const rightSequence = Array.from({ length: 20 }, () =>
      selectWeightedVariant(domain, definitions, neutralContext, right),
    );

    expect(leftSequence).toEqual(rightSequence);
    expect(leftSequence).not.toContain(1);
  });

  it('returns null for an empty domain without consuming randomness', () => {
    const rng = createRng(42);
    const before = rng.value;
    expect(
      selectWeightedVariant(createEmptyMask(), [], neutralContext, rng),
    ).toBeNull();
    expect(rng.value).toBe(before);
  });
});

describe('observation priority', () => {
  const candidate = (
    overrides: Partial<ObservationPriorityCandidate>,
  ): ObservationPriorityCandidate => ({
    cellId: 4,
    observationCharge: 0.5,
    boundaryContinuity: 0.4,
    normalizedEntropy: 0.25,
    deterministicNoise01: 0.5,
    ...overrides,
  });

  it('matches the normative priority formula', () => {
    expect(observationPriority(candidate({}))).toBeCloseTo(2.4, 12);
    expect(
      observationPriority(candidate({ deterministicNoise01: 1 })),
    ).toBeCloseTo(2.400001, 12);
  });

  it('filters ineligible cells and resolves exact ties by stable cell id', () => {
    const selected = selectHighestPriorityCell([
      candidate({ cellId: 8 }),
      candidate({ cellId: 3 }),
      candidate({
        cellId: 1,
        observationCharge: 1,
        eligible: false,
      }),
    ]);

    expect(selected?.cellId).toBe(3);
  });

  it('rejects inputs outside normalized solver ranges', () => {
    expect(() =>
      observationPriority(candidate({ normalizedEntropy: 1.1 })),
    ).toThrow(RangeError);
    expect(() =>
      observationPriority(candidate({ deterministicNoise01: -0.1 })),
    ).toThrow(RangeError);
  });
});
