import { describe, expect, it } from 'vitest';

import { ObservableWorldBridge } from '../../src/app/observable-world-bridge';
import { RunClock } from '../../src/gameplay/run-clock';

describe('run ending integration boundaries', () => {
  it('pauses on hidden tabs and rejects worker commits after zero', () => {
    const clock = new RunClock({}, { durationSeconds: 1 });
    const bridge = new ObservableWorldBridge({
      solver: {
        sendObservation: () => 1,
        sendUnlockPack: () => 1,
        reset: () => 1,
      },
      getPlayerPosition: () => [65, 1.7, 65],
      canObserve: () => clock.snapshot().canCommit,
      canAcceptCollapse: () => clock.canCommit(),
    });
    clock.notifyFirstCollapse();
    clock.setPaused('HIDDEN', true);
    clock.update(2);
    expect(clock.snapshot().phase).toBe('RUNNING');
    clock.setPaused('HIDDEN', false);
    clock.update(1);
    expect(clock.snapshot().phase).toBe('ENDING');
    expect(
      bridge.handleWorkerOutput(
        {
          type: 'COLLAPSE',
          cellId: 2_080,
          terrainTileId: 0,
          featureTileId: null,
          entropyBefore: 1,
          durationMs: 450,
          worldSeed: 1,
        },
        0,
      ),
    ).toBe(false);
  });
});
