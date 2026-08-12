import { describe, expect, it, vi } from 'vitest';

import {
  Wp5PreviewRuntime,
  type Wp5VisualAdapter,
} from '../../src/app/wp5-preview-runtime';

function visuals(): Wp5VisualAdapter {
  return {
    collectSeed: vi.fn(),
    setRespawnPhase: vi.fn(),
    update: vi.fn(),
  };
}

describe('Wp5PreviewRuntime', () => {
  it('runs the complete gated WP5 sequence without enabling it by default', () => {
    const visualAdapter = visuals();
    const teleportPlayer = vi.fn();
    const fractureRegion = vi.fn();
    const narrativeCues: string[] = [];
    const runtime = new Wp5PreviewRuntime({
      worldSeed: 0xa91f42c0,
      unlockPack: (packId) =>
        ['water', 'forest', 'ruin', 'storm'].indexOf(packId) + 1,
      visuals: visualAdapter,
      canonicalAutomation: true,
      teleportPlayer,
      ensureRespawnGround: () => undefined,
      isRespawnWalkable: () => true,
      fractureRegion,
      onNarrativeCue: (cueId) => narrativeCues.push(cueId),
    });
    const frame = {
      deltaSeconds: 1,
      playerPosition: [64, 1.7, 64] as const,
      cameraForward: [0, 0, -1] as const,
      playerCellId: 2_080,
      fixedCells: 60,
    };

    for (let tick = 0; tick < 18; tick += 1) runtime.update(frame);
    runtime.registerConsciousnessBomb(frame.playerCellId);
    runtime.update(frame);
    const snapshot = runtime.snapshot();
    expect(snapshot.progression.collectedPacks).toEqual([
      'water',
      'forest',
      'ruin',
      'storm',
    ]);
    expect(snapshot.bombCount).toBe(0);
    expect(snapshot.respawn.deaths).toBe(1);
    expect(teleportPlayer).toHaveBeenCalledTimes(1);
    expect(fractureRegion).toHaveBeenCalledTimes(1);
    expect(visualAdapter.collectSeed).toHaveBeenCalledTimes(4);
    expect(narrativeCues).toEqual([
      'unlockWater',
      'unlockForest',
      'unlockRuin',
      'unlockStorm',
      'firstDeath',
      'respawn',
    ]);
  });
});
