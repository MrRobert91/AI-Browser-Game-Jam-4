import { describe, expect, it } from 'vitest';

import { GRAMMAR_SOURCE } from '../../src/content/grammar';
import { validateGrammar } from '../../src/content/grammar-validator';

describe('forest pack', () => {
  it('adapts clearing and root meadow directly to OPEN_FLAT', () => {
    for (const id of [
      'terrain.forest.clearing',
      'terrain.forest.root-meadow',
    ]) {
      const tile = GRAMMAR_SOURCE.terrain.find(
        (candidate) => candidate.id === id,
      );
      expect(Object.values(tile?.sockets ?? {})).toEqual([
        'OPEN_FLAT',
        'OPEN_FLAT',
        'OPEN_FLAT',
        'OPEN_FLAT',
      ]);
    }
  });

  it('keeps blocking trees and trunks away from reserved corridors', () => {
    const blockers = GRAMMAR_SOURCE.features.filter(
      (feature) => feature.packId === 'forest' && feature.blocksMovement,
    );
    expect(blockers.map((feature) => feature.id)).toEqual([
      'feature.forest.young-tree',
      'feature.forest.old-tree',
      'feature.forest.fallen-trunk',
    ]);
    expect(
      blockers.every(
        (feature) => (feature.forbiddenWithinMetersOf.corridor ?? 0) >= 2.5,
      ),
    ).toBe(true);
  });

  it('passes the normative grammar validator', () => {
    expect(validateGrammar(GRAMMAR_SOURCE).issues).toEqual([]);
  });
});
