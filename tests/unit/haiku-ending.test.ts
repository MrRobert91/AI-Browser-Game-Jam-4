import { describe, expect, it } from 'vitest';

import {
  classifyEnding,
  closureForSeedCount,
  EndingDirector,
  describeAgentUpdate,
  formatRunResult,
  formatSeed,
  MISSION_COMPLETE_FIXED_CELLS,
  normalizeRunResult,
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
    expect(first.lines.join(' ')).not.toContain('Ã');
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

  it('classifies the exact mission-complete eligibility boundaries', () => {
    const qualified = {
      mode: 'standard' as const,
      endingReason: 'TIME_EXPIRED' as const,
      livesRemaining: 1,
      collectedPacks: ['water', 'forest', 'ruin', 'storm'],
      finalFixedCells: MISSION_COMPLETE_FIXED_CELLS,
    };
    expect(classifyEnding(qualified)).toBe('MISSION_COMPLETE');
    expect(
      classifyEnding({
        ...qualified,
        finalFixedCells: MISSION_COMPLETE_FIXED_CELLS - 1,
      }),
    ).toBe('STANDARD');
    expect(classifyEnding({ ...qualified, collectedPacks: qualified.collectedPacks.slice(0, 3) })).toBe('STANDARD');
    expect(classifyEnding({ ...qualified, livesRemaining: 0 })).toBe('STANDARD');
    expect(classifyEnding({ ...qualified, endingReason: 'LIVES_EXHAUSTED' })).toBe('STANDARD');
    expect(classifyEnding({ ...qualified, mode: 'brief' })).toBe('STANDARD');
    expect(classifyEnding({ ...qualified, mode: 'contemplative' })).toBe('STANDARD');
  });

  it('places the mission video after ascent and only skips after three seconds', () => {
    const ending = new EndingDirector();
    ending.start('MISSION_COMPLETE');
    expect(ending.update(8)).toMatchObject({
      phase: 'MISSION_VIDEO',
      phaseElapsedSeconds: 0,
      canSkipMissionVideo: false,
    });
    expect(ending.update(2.99).canSkipMissionVideo).toBe(false);
    expect(ending.skipMissionVideo().phase).toBe('MISSION_VIDEO');
    expect(ending.update(0.01).canSkipMissionVideo).toBe(true);
    expect(ending.skipMissionVideo().phase).toBe('COMPLETE');
  });

  it('upgrades legacy stored results as STANDARD', () => {
    const normalized = normalizeRunResult({
      endReason: 'TIME_EXPIRED',
      seedLabel: 'A91F-42C0',
      portrait: PORTRAIT,
      haiku: generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo'),
    });
    expect(normalized).toMatchObject({
      endingVariant: 'STANDARD',
      endingReason: 'TIME_EXPIRED',
      livesRemaining: 0,
      finalFixedCells: 144,
    });
  });

  it('formats the seed, qualitative closure and copy payload', () => {
    const haiku = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo');
    const closure = closureForSeedCount(3);
    expect(closure.closure).toBe('Mundo habitable');
    const text = formatRunResult({
      endingVariant: 'STANDARD',
      endingReason: 'TIME_EXPIRED',
      livesRemaining: 2,
      finalFixedCells: PORTRAIT.fixedCells,
      worldSeed: 0xa91f42c0,
      seedLabel: formatSeed(0xa91f42c0),
      profile: 'Cartógrafo',
      portrait: PORTRAIT,
      haiku,
      ...closure,
    });
    expect(text).toContain('LA ÚLTIMA OBSERVACIÓN');
    expect(text).toContain('EXPEDIENTE DE ACTUALIZACIÓN DEL AGENTE');
    expect(text).toContain('Seed: A91F-42C0');
    expect(text).toContain('Perfil: Cartógrafo');
    expect(text).toContain('Haiku:');
    expect(text).toContain('Lectura: Mundo habitable');
    expect(text).toContain('sin reconocimiento de causalidad cosmológica');
    expect(
      describeAgentUpdate({
        endingVariant: 'STANDARD',
        endingReason: 'TIME_EXPIRED',
        livesRemaining: 2,
        finalFixedCells: PORTRAIT.fixedCells,
        worldSeed: 0xa91f42c0,
        seedLabel: formatSeed(0xa91f42c0),
        profile: 'Cartógrafo',
        portrait: PORTRAIT,
        haiku,
        ...closure,
      }),
    ).toBe(
      '144 resultados, 16 formas; intervenciones lejanas; con exposición al riesgo.',
    );
  });
});
