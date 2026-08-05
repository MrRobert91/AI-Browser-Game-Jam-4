import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import type {
  SocketCompatibilityDocument,
  TerrainTileDefinition,
} from '../../src/contracts/tiles';
import { GRAMMAR_SOURCE } from '../../src/content/grammar';
import type { GrammarSource } from '../../src/content/grammar-compiler';
import {
  formatGrammarIssues,
  validateGrammar,
} from '../../src/content/grammar-validator';

async function listAssets(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listAssets(path) : [path];
      }),
    )
  ).flat();
}

async function knownAssets(): Promise<Set<string>> {
  const root = resolve('public');
  return new Set(
    (await listAssets(resolve(root, 'assets'))).map(
      (path) => `/${relative(root, path).split(sep).join('/')}`,
    ),
  );
}

function withTerrain(
  mutate: (tile: TerrainTileDefinition) => TerrainTileDefinition,
): GrammarSource {
  const [first, ...rest] = GRAMMAR_SOURCE.terrain;
  if (first === undefined) throw new Error('Expected base terrain fixture');
  return { ...GRAMMAR_SOURCE, terrain: [mutate(first), ...rest] };
}

describe('validate:tiles green fixture', () => {
  it('accepts the checked-in grammar and all referenced assets', async () => {
    const result = validateGrammar(GRAMMAR_SOURCE, await knownAssets());
    expect(formatGrammarIssues(result.issues)).toBe('');
    expect(result.valid).toBe(true);
  });
});

describe('validate:tiles red fixtures', () => {
  it('identifies an unknown socket with tile and direction', () => {
    const source = withTerrain((tile) => ({
      ...tile,
      sockets: { ...tile.sockets, N: 'UNKNOWN' as never },
    }));
    expect(formatGrammarIssues(validateGrammar(source).issues)).toMatch(
      /terrain\.meadow\.a direction N uses unknown socket UNKNOWN/,
    );
  });

  it('rejects missing reciprocity', () => {
    const compatibility = structuredClone(
      GRAMMAR_SOURCE.socketCompatibility,
    ) as SocketCompatibilityDocument;
    const source = {
      ...GRAMMAR_SOURCE,
      socketCompatibility: {
        ...compatibility,
        sockets: { ...compatibility.sockets, PATH: ['PATH'] as const },
      },
    };
    expect(
      validateGrammar(source).issues.some(
        (issue) => issue.code === 'RECIPROCITY_MISSING',
      ),
    ).toBe(true);
  });

  it('rejects duplicate ids, numeric ids, invalid weights and rotations', () => {
    const first = GRAMMAR_SOURCE.terrain[0];
    if (first === undefined) throw new Error('Expected terrain fixture');
    const source = {
      ...GRAMMAR_SOURCE,
      terrain: [
        { ...first, weight: 0, rotationQuarterTurns: [9 as never] },
        { ...first },
        ...GRAMMAR_SOURCE.terrain.slice(1),
      ],
    };
    const codes = validateGrammar(source).issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_ID',
        'DUPLICATE_NUMERIC_ID',
        'INVALID_WEIGHT',
        'INVALID_ROTATION',
      ]),
    );
  });

  it('requires at least two compatible exits', () => {
    const only = GRAMMAR_SOURCE.terrain[0];
    if (only === undefined) throw new Error('Expected terrain fixture');
    const result = validateGrammar({ ...GRAMMAR_SOURCE, terrain: [only] });
    expect(
      result.issues.some((issue) => issue.code === 'SOCKET_WITHOUT_TWO_EXITS'),
    ).toBe(true);
  });

  it('prints the shortest unresolved path for a pack without an OPEN_FLAT adapter', () => {
    const isolated = withTerrain((tile) => ({
      ...tile,
      id: 'terrain.isolated',
      packId: 'water',
      sockets: { N: 'WET_FLAT', E: 'WET_FLAT', S: 'WET_FLAT', W: 'WET_FLAT' },
    }));
    const result = validateGrammar({
      ...isolated,
      terrain: [isolated.terrain[0]!],
    });
    expect(formatGrammarIssues(result.issues)).toMatch(
      /Pack water has no transition to OPEN_FLAT[\s\S]*terrain\.isolated direction N -> WET_FLAT/,
    );
  });

  it('rejects lethal safe-radius content, missing tags and missing assets', async () => {
    const feature = GRAMMAR_SOURCE.features[0];
    if (feature === undefined) throw new Error('Expected feature fixture');
    const source = {
      ...GRAMMAR_SOURCE,
      features: [
        {
          ...feature,
          lethal: true,
          minDistanceFromOrigin: 0,
          allowedTerrainTags: ['absent'],
        },
      ],
    };
    const codes = validateGrammar(source, await knownAssets()).issues.map(
      (issue) => issue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining(['LETHAL_IN_SAFE_RADIUS', 'FEATURE_TAG_MISSING']),
    );

    const missing = validateGrammar(
      withTerrain((tile) => ({ ...tile, mesh: '/assets/missing.proxy.json' })),
      await knownAssets(),
    );
    expect(missing.issues.some((issue) => issue.code === 'ASSET_MISSING')).toBe(
      true,
    );
  });
});
