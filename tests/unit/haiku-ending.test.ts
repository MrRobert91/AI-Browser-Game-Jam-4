import { describe, expect, it } from 'vitest';

import {
  closureForSeedCount,
  EndingDirector,
  formatRunResult,
  formatSeed,
} from '../../src/gameplay/ending';
import {
  approximateSpanishSyllables,
  generateHaiku,
} from '../../src/gameplay/haiku';
import type { AttentionPortrait } from '../../src/gameplay/portrait';

const PORTRAIT: AttentionPortrait = {
  fixedCells: 144,
  uniqueTerrainTiles: 9,
  uniqueFeatureTiles: 7,
  unlockedPacks: ['water', 'forest', 'ruin'],
  deaths: 3,
  dangerExposureSeconds: 31,
  averageGazeDwell: 1.3,
  revisitRatio: 0.3,
  maxDistance: 42,
  waterRatio: 0.2,
  forestRatio: 0.3,
  ruinRatio: 0.1,
  unresolvedVisibleCells: 12,
};

describe('local haiku and ending', () => {
  it('generates the same three local lines for the same replay portrait', () => {
    const first = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo');
    const second = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo');
    expect(second).toEqual(first);
    expect(first.lines).toHaveLength(3);
    for (const line of first.lines) {
      expect(approximateSpanishSyllables(line)).toBeGreaterThanOrEqual(8);
      expect(approximateSpanishSyllables(line)).toBeLessThanOrEqual(17);
    }
  });

  it('keeps all three canonical poems in the local fallback catalog', async () => {
    const catalog = await import('../../src/content/haiku-lines.json');
    const serialized = JSON.stringify(catalog.default);
    expect(serialized).toContain('Muchos caminos.');
    expect(serialized).toContain('El agua termina.');
    expect(serialized).toContain('Moriste tres veces.');
  });

  it('ascends for exactly eight seconds before completing', () => {
    const ending = new EndingDirector();
    ending.start();
    expect(ending.update(7.99).phase).toBe('ASCENDING');
    expect(ending.update(0.01)).toMatchObject({
      phase: 'COMPLETE',
      progress: 1,
      elapsedSeconds: 8,
    });
  });

  it('formats the seed, qualitative closure and copy payload', () => {
    const haiku = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo');
    const closure = closureForSeedCount(3);
    expect(closure.closure).toBe('Mundo habitable');
    const text = formatRunResult({
      worldSeed: 0xa91f42c0,
      seedLabel: formatSeed(0xa91f42c0),
      profile: 'Cartógrafo',
      portrait: PORTRAIT,
      haiku,
      ...closure,
    });
    expect(text).toContain('LA ÚLTIMA OBSERVACIÓN');
    expect(text).toContain('Seed: A91F-42C0');
    expect(text).toContain('Perfil: Cartógrafo');
    expect(text).toContain('Haiku:');
  });
});
