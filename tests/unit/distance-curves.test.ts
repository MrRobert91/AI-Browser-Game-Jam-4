import { describe, expect, it } from 'vitest';

import {
  applyDistanceWeights,
  danger01,
  maximumActiveEnemies,
  rarityMultiplier,
  staticHazardChance,
} from '../../src/gameplay/distance-curves';

describe('distance progression curves', () => {
  it('matches the normative danger and rarity edges', () => {
    expect(danger01(0)).toBe(0);
    expect(danger01(14)).toBe(0);
    expect(danger01(52)).toBe(1);
    expect(danger01(100)).toBe(1);
    expect(rarityMultiplier(0)).toBe(0.65);
    expect(rarityMultiplier(8)).toBe(0.65);
    expect(rarityMultiplier(52)).toBe(1.8);
    expect(rarityMultiplier(100)).toBe(1.8);
  });

  it('uses 0/3/7/11/14 percent hazard bands and 0-4 enemies', () => {
    expect(staticHazardChance(14)).toBe(0);
    expect(staticHazardChance(14.01)).toBe(0.03);
    expect(staticHazardChance(24)).toBe(0.07);
    expect(staticHazardChance(38)).toBe(0.11);
    expect(staticHazardChance(52)).toBe(0.11);
    expect(staticHazardChance(52.01)).toBe(0.14);

    expect([0, 15, 25, 40, 53].map(maximumActiveEnemies)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it('changes positive weights without deleting the final legal candidate', () => {
    const candidates = [
      { id: 'common', weight: 14, rarity: 0 },
      { id: 'rare', weight: 0.25, rarity: 1 },
    ] as const;
    const near = applyDistanceWeights(candidates, 8, (tile) => tile.rarity);
    const far = applyDistanceWeights(candidates, 52, (tile) => tile.rarity);

    expect(near).toHaveLength(candidates.length);
    expect(far).toHaveLength(candidates.length);
    expect(near.every((tile) => tile.effectiveWeight > 0)).toBe(true);
    expect(far.every((tile) => tile.effectiveWeight > 0)).toBe(true);
    expect(far[1]!.effectiveWeight).toBeGreaterThan(near[1]!.effectiveWeight);
    expect(far[0]!.effectiveWeight).toBe(near[0]!.effectiveWeight);
  });
});
