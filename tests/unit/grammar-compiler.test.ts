import { describe, expect, it } from 'vitest';

import type {
  FeatureTileDefinition,
  SocketCompatibilityDocument,
  TerrainTileDefinition,
} from '../../src/contracts/tiles';
import {
  compileGrammar,
  compileTerrainVariants,
  rotateSockets,
} from '../../src/content/grammar-compiler';

const meadow: TerrainTileDefinition = {
  id: 'terrain.meadow.a',
  numericId: 0,
  packId: 'base',
  weight: 14,
  mesh: '/assets/proxies/meadow-a.proxy.json',
  rotationQuarterTurns: [0],
  sockets: { N: 'OPEN_FLAT', E: 'OPEN_FLAT', S: 'OPEN_FLAT', W: 'OPEN_FLAT' },
  tags: ['meadow', 'walkable'],
  walkable: true,
  lethal: false,
  heightClass: 0,
  fallbackRank: 0,
};

const empty: FeatureTileDefinition = {
  id: 'feature.empty',
  numericId: 0,
  packId: 'base',
  weight: 18,
  mesh: null,
  tags: ['empty'],
  allowedTerrainTags: ['walkable'],
  forbiddenWithinMetersOf: {},
  minDistanceFromOrigin: 0,
  maxSlopeDegrees: 38,
  blocksMovement: false,
  lethal: false,
};

const sockets: SocketCompatibilityDocument = {
  version: 1,
  sockets: {
    OPEN_FLAT: ['OPEN_FLAT'],
    WET_FLAT: ['WET_FLAT'],
    BANK_IN: ['BANK_OUT'],
    BANK_OUT: ['BANK_IN'],
    PATH: ['PATH'],
    RUIN_FLOOR: ['RUIN_FLOOR'],
    CLIFF_LOW: ['CLIFF_LOW'],
  },
};

describe('grammar compiler', () => {
  it('rotates sockets clockwise without mutating the source', () => {
    const source = {
      N: 'PATH',
      E: 'OPEN_FLAT',
      S: 'BANK_IN',
      W: 'BANK_OUT',
    } as const;
    expect(rotateSockets(source, 1)).toEqual({
      N: 'BANK_OUT',
      E: 'PATH',
      S: 'OPEN_FLAT',
      W: 'BANK_IN',
    });
    expect(source.N).toBe('PATH');
  });

  it('assigns stable variant ids and compiles solver masks', () => {
    const grammar = compileGrammar({
      terrain: [meadow],
      features: [empty],
      socketCompatibility: sockets,
    });
    expect(grammar.terrain.map((variant) => variant.variantId)).toEqual([0]);
    expect(grammar.features[0]?.definitionNumericId).toBe(0);
    expect(grammar.terrainCompatibility.N[0]).toEqual({ lo: 1, hi: 0 });
  });

  it('rejects duplicate symmetric rotations and more than 64 variants', () => {
    expect(() =>
      compileTerrainVariants([{ ...meadow, rotationQuarterTurns: [0, 1] }]),
    ).toThrow(/duplicate rotation/);
    expect(() =>
      compileTerrainVariants(
        Array.from({ length: 65 }, (_, numericId) => ({
          ...meadow,
          id: `terrain.${numericId}`,
          numericId,
        })),
      ),
    ).toThrow(/maximum is 64/);
  });
});
