import { describe, expect, it } from 'vitest';

import { GRAMMAR_SOURCE } from '../../src/content/grammar';
import { validateGrammar } from '../../src/content/grammar-validator';

describe('ruin pack', () => {
  it('connects Broken Threshold to OPEN_FLAT', () => {
    const threshold = GRAMMAR_SOURCE.terrain.find(
      (tile) => tile.id === 'terrain.ruin.broken-threshold',
    );
    expect(Object.values(threshold?.sockets ?? {})).toContain('OPEN_FLAT');
    expect(threshold?.tags).toContain('adapter');
  });

  it('requires structural support and protects the only corridor', () => {
    const structures = GRAMMAR_SOURCE.features.filter(
      (feature) => feature.packId === 'ruin',
    );
    expect(structures).toHaveLength(4);
    expect(
      structures.every(
        (feature) =>
          feature.allowedTerrainTags.includes('structural_support') &&
          (feature.forbiddenWithinMetersOf.corridor ?? 0) >= 2.5,
      ),
    ).toBe(true);
  });

  it('passes the normative grammar validator', () => {
    expect(validateGrammar(GRAMMAR_SOURCE).issues).toEqual([]);
  });
});
