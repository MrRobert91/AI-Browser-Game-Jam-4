import { describe, expect, it } from 'vitest';

import {
  AttentionPortraitTracker,
  classifyAttentionPortrait,
  type AttentionPortrait,
} from '../../src/gameplay/portrait';

const BASE: AttentionPortrait = {
  fixedCells: 100,
  uniqueTerrainTiles: 6,
  uniqueFeatureTiles: 4,
  unlockedPacks: ['water', 'forest'],
  deaths: 0,
  dangerExposureSeconds: 10,
  averageGazeDwell: 0.8,
  revisitRatio: 0.2,
  maxDistance: 25,
  waterRatio: 0.1,
  forestRatio: 0.1,
  ruinRatio: 0,
  unresolvedVisibleCells: 5,
};

describe('AttentionPortrait', () => {
  it('collects the normative metrics without counting duplicate fixed cells', () => {
    const tracker = new AttentionPortraitTracker();
    tracker.recordFixedCell({
      cellId: 1,
      terrainTileId: 3,
      featureTileId: 5,
      family: 'forest',
    });
    tracker.recordFixedCell({
      cellId: 1,
      terrainTileId: 3,
      featureTileId: 5,
      family: 'forest',
    });
    tracker.recordGaze(1, 1.2);
    tracker.recordGaze(1, 0.8);
    tracker.recordUnlock('forest');
    tracker.recordDeath();
    tracker.recordFrame({
      deltaSeconds: 2,
      playerPosition: [84, 1.7, 64],
      inDanger: true,
      unresolvedVisibleCells: 7,
    });
    expect(tracker.snapshot()).toMatchObject({
      fixedCells: 1,
      uniqueTerrainTiles: 1,
      uniqueFeatureTiles: 1,
      unlockedPacks: ['forest'],
      deaths: 1,
      dangerExposureSeconds: 2,
      averageGazeDwell: 1,
      revisitRatio: 0.5,
      maxDistance: 20,
      forestRatio: 1,
      unresolvedVisibleCells: 7,
    });
  });

  it.each([
    ['Jardinero', { forestRatio: 0.7, revisitRatio: 0.7, maxDistance: 10 }],
    [
      'Cartógrafo',
      {
        maxDistance: 52,
        uniqueTerrainTiles: 12,
        uniqueFeatureTiles: 10,
        fixedCells: 220,
      },
    ],
    ['Guardián', { deaths: 0, revisitRatio: 0.8, dangerExposureSeconds: 0 }],
    [
      'Testigo',
      { averageGazeDwell: 2.2, fixedCells: 20, dangerExposureSeconds: 0 },
    ],
    [
      'Impaciente',
      {
        maxDistance: 52,
        dangerExposureSeconds: 90,
        averageGazeDwell: 0.1,
        deaths: 3,
      },
    ],
  ] as const)('reaches the %s profile deterministically', (profile, patch) => {
    expect(classifyAttentionPortrait({ ...BASE, ...patch })).toBe(profile);
  });
});
