import { describe, expect, it } from 'vitest';

import { COMPILED_GRAMMAR, GRAMMAR_SOURCE } from '../../src/content/grammar';

describe('base tile grammar', () => {
  it('contains two visually distinct meadows with identical sockets', () => {
    const meadowA = GRAMMAR_SOURCE.terrain.find(
      (tile) => tile.id === 'terrain.meadow.a',
    );
    const meadowB = GRAMMAR_SOURCE.terrain.find(
      (tile) => tile.id === 'terrain.meadow.b',
    );
    expect(meadowA?.sockets).toEqual(meadowB?.sockets);
    expect(meadowA?.mesh).not.toBe(meadowB?.mesh);
  });

  it('keeps every playable base tile weighted, walkable and non-lethal', () => {
    const base = GRAMMAR_SOURCE.terrain.filter(
      (tile) => tile.packId === 'base',
    );
    expect(base.length).toBeGreaterThanOrEqual(9);
    expect(
      base.every((tile) => tile.weight > 0 && tile.walkable && !tile.lethal),
    ).toBe(true);
  });

  it('provides universal quantum fallbacks and a safe origin monolith', () => {
    expect(
      GRAMMAR_SOURCE.terrain
        .filter((tile) => tile.tags.includes('fallback'))
        .map((tile) => tile.id),
    ).toEqual(['terrain.quantum-meadow', 'terrain.quantum-slab']);
    const origin = GRAMMAR_SOURCE.features.find(
      (feature) => feature.id === 'feature.origin-monolith',
    );
    expect(origin).toMatchObject({
      lethal: false,
      minDistanceFromOrigin: 0,
      uniquePerChunk: true,
    });
    expect(COMPILED_GRAMMAR.terrain.length).toBeLessThanOrEqual(64);
    expect(COMPILED_GRAMMAR.features.length).toBeLessThanOrEqual(64);
  });
});
