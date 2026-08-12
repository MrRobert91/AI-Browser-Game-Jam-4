import { describe, expect, it } from 'vitest';

import { COMPILED_GRAMMAR, GRAMMAR_SOURCE } from '../../src/content/grammar';
import {
  STORM_PULSE_SECONDS,
  stormEmissiveIntensity,
} from '../../src/render/storm-visual';

describe('storm stretch pack', () => {
  it('ships its terrains, hazards and explicit OPEN_FLAT adapter within layer budgets', () => {
    const terrainIds = GRAMMAR_SOURCE.terrain
      .filter((tile) => tile.packId === 'storm')
      .map((tile) => tile.id);
    const featureIds = GRAMMAR_SOURCE.features
      .filter((tile) => tile.packId === 'storm')
      .map((tile) => tile.id);
    const adapter = GRAMMAR_SOURCE.terrain.find(
      (tile) => tile.id === 'terrain.storm.scorched-meadow',
    );

    expect(terrainIds).toEqual(
      expect.arrayContaining([
        'terrain.storm.charged-soil',
        'terrain.storm.glass-ground',
        'terrain.storm.scorched-meadow',
      ]),
    );
    expect(featureIds).toEqual(
      expect.arrayContaining([
        'feature.storm.crystal',
        'feature.storm.bell-flower',
        'feature.storm.mirror-reed',
      ]),
    );
    expect(new Set(Object.values(adapter?.sockets ?? {}))).toEqual(
      new Set(['OPEN_FLAT']),
    );
    expect(COMPILED_GRAMMAR.terrain.length).toBeLessThanOrEqual(64);
    expect(COMPILED_GRAMMAR.features.length).toBeLessThanOrEqual(64);
  });

  it('keeps Storm hazards outside the inner game and uses a slow non-flashing pulse', () => {
    const hazards = GRAMMAR_SOURCE.features.filter(
      (tile) => tile.packId === 'storm' && tile.tags.includes('hazard'),
    );
    expect(hazards.every((tile) => tile.minDistanceFromOrigin >= 38)).toBe(
      true,
    );
    expect(STORM_PULSE_SECONDS).toBeGreaterThanOrEqual(2.5);
    expect(stormEmissiveIntensity(0, true)).toBe(
      stormEmissiveIntensity(1.25, true),
    );
    expect(stormEmissiveIntensity(1.25, false)).toBeLessThanOrEqual(0.65);
  });
});
