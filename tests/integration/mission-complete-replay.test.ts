import { describe, expect, it } from 'vitest';

import { applyMissionCompleteReplayOutcome } from '../../src/dev/mission-complete-replay';
import {
  classifyEnding,
  MISSION_COMPLETE_FIXED_CELLS,
} from '../../src/gameplay/ending';
import { WorldState } from '../../src/world/world-state';

describe('mission-complete deterministic replay', () => {
  it('uses final FIXED state and never counts fractured cells', () => {
    const world = new WorldState();
    const outcome = applyMissionCompleteReplayOutcome(world);
    expect(outcome.finalFixedCells).toBe(MISSION_COMPLETE_FIXED_CELLS);
    expect(
      classifyEnding({
        mode: 'standard',
        endingReason: 'TIME_EXPIRED',
        ...outcome,
      }),
    ).toBe('MISSION_COMPLETE');

    world.fractureFixedCells([0]);
    expect(world.countFixedCells()).toBe(MISSION_COMPLETE_FIXED_CELLS - 1);
    expect(
      classifyEnding({
        mode: 'standard',
        endingReason: 'TIME_EXPIRED',
        livesRemaining: outcome.livesRemaining,
        collectedPacks: outcome.collectedPacks,
        finalFixedCells: world.countFixedCells(),
      }),
    ).toBe('STANDARD');
  });
});
