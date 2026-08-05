import { bench, describe } from 'vitest';

import { createFullMask } from '../../src/wfc/bitset';
import {
  selectWeightedVariant,
  weightedEntropy,
  type WeightDefinition,
} from '../../src/wfc/entropy';
import { createRng } from '../../src/wfc/rng';

const fullDomain = createFullMask(64);
const definitions: readonly WeightDefinition[] = Array.from(
  { length: 64 },
  (_, index) => ({
    weight: 1 + (index % 11),
    distanceCurve: [
      [0, 0.75],
      [52, 1.8],
    ],
    neighborBias: { meadow: 1.15, water: 0.85 },
  }),
);
const context = {
  distanceFromOrigin: 31,
  neighborTagCounts: { meadow: 2, water: 1 },
  progressionMultiplier: 1.1,
  deterministicNoiseByVariant: Array.from(
    { length: 64 },
    (_, index) => index / 63,
  ),
} as const;
const rng = createRng(0xa91f42c0);

describe('64-variant entropy hot path', () => {
  bench('weighted entropy', () => {
    weightedEntropy(fullDomain, definitions, context);
  });

  bench('weighted selection', () => {
    selectWeightedVariant(fullDomain, definitions, context, rng);
  });
});
