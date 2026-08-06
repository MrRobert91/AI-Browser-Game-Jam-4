import { describe, expect, it } from 'vitest';

import { COMPILED_GRAMMAR, GRAMMAR_SOURCE } from '../../src/content/grammar';
import { validateGrammar } from '../../src/content/grammar-validator';
import { planSeedAnchors } from '../../src/gameplay/anchors';

describe('release grammar properties', () => {
  it('preserves all six normative grammar invariants', () => {
    const validation = validateGrammar(GRAMMAR_SOURCE);
    expect(validation.issues).toEqual([]);
    expect(COMPILED_GRAMMAR.terrain.length).toBeLessThanOrEqual(64);
    expect(COMPILED_GRAMMAR.features.length).toBeLessThanOrEqual(64);
    expect(GRAMMAR_SOURCE.terrain.every((tile) => tile.weight > 0)).toBe(true);
    expect(
      GRAMMAR_SOURCE.features
        .filter((feature) => feature.lethal)
        .every((feature) => feature.minDistanceFromOrigin >= 4),
    ).toBe(true);
    expect(
      GRAMMAR_SOURCE.features.every(
        (feature) => feature.mesh !== null || feature.tags.includes('empty'),
      ),
    ).toBe(true);
  });

  it('keeps every deterministic Seed corridor reachable across 1,000 seeds', () => {
    for (let seed = 0; seed < 1_000; seed += 1) {
      const plan = planSeedAnchors(seed);
      expect(plan.anchors).toHaveLength(4);
      expect(
        plan.anchors.every((anchor) => anchor.corridorCellIds.length > 0),
      ).toBe(true);
    }
  });
});
