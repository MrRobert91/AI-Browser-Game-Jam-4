import { describe, expect, it } from 'vitest';

import { GRAMMAR_SOURCE } from '../../src/content/grammar';
import { validateGrammar } from '../../src/content/grammar-validator';

describe('water pack', () => {
  it('provides the complete deep-to-land chain with safe adapters', () => {
    const water = GRAMMAR_SOURCE.terrain.filter(
      (tile) => tile.packId === 'water',
    );
    expect(water.map((tile) => tile.id)).toEqual([
      'terrain.water.deep',
      'terrain.water.shallow',
      'terrain.water.shore',
      'terrain.water.marsh',
    ]);
    expect(water.find((tile) => tile.id.endsWith('deep'))?.walkable).toBe(
      false,
    );
    expect(
      Object.values(
        water.find((tile) => tile.id.endsWith('shore'))?.sockets ?? {},
      ),
    ).toContain('OPEN_FLAT');
    expect(water.find((tile) => tile.id.endsWith('marsh'))?.sockets).toEqual({
      N: 'OPEN_FLAT',
      E: 'OPEN_FLAT',
      S: 'OPEN_FLAT',
      W: 'OPEN_FLAT',
    });
  });

  it('keeps water features non-lethal and terrain-constrained', () => {
    const features = GRAMMAR_SOURCE.features.filter(
      (feature) => feature.packId === 'water',
    );
    expect(features.map((feature) => feature.id)).toEqual([
      'feature.water.reeds',
      'feature.water.lilies',
      'feature.water.spring',
    ]);
    expect(
      features.every(
        (feature) => !feature.lethal && feature.allowedTerrainTags.length > 0,
      ),
    ).toBe(true);
  });

  it('passes the normative grammar validator', () => {
    const result = validateGrammar(GRAMMAR_SOURCE);
    expect(result.issues).toEqual([]);
  });
});
