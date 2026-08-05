import { describe, expect, it, vi } from 'vitest';

import { planSeedAnchors } from '../../src/gameplay/anchors';
import {
  SEED_COLLECTION_PAUSE_SECONDS,
  SEED_PACK_ORDER,
  ProgressionSystem,
} from '../../src/gameplay/progression';

describe('ProgressionSystem', () => {
  it('collects seeds only in Water, Forest, Ruin, Storm order', () => {
    const plan = planSeedAnchors(42);
    const unlockPack = vi.fn(
      (packId: string) =>
        SEED_PACK_ORDER.indexOf(packId as (typeof SEED_PACK_ORDER)[number]) + 1,
    );
    const progression = new ProgressionSystem(plan, { unlockPack });

    expect(progression.collectAt(progression.getSeedCell('forest'))).toBeNull();
    for (const [index, packId] of SEED_PACK_ORDER.entries()) {
      const event = progression.collectAt(progression.getSeedCell(packId));
      expect(event).toMatchObject({ packId, paletteEpoch: index + 1 });
      expect(event?.previewSilhouettes).toHaveLength(3);
      expect(event?.musicStemId).toBe(`stem-${packId}`);
    }
    expect(progression.snapshot().nextPack).toBeNull();
    expect(unlockPack).toHaveBeenCalledTimes(4);
  });

  it('pauses for 1.5 seconds without exposing a choice menu', () => {
    const progression = new ProgressionSystem(planSeedAnchors(3), {
      unlockPack: () => 1,
    });
    const event = progression.collectAt(progression.getSeedCell('water'));

    expect(event?.pauseSeconds).toBe(SEED_COLLECTION_PAUSE_SECONDS);
    expect(progression.isClockPaused()).toBe(true);
    progression.update(1.49);
    expect(progression.isClockPaused()).toBe(true);
    progression.update(0.01);
    expect(progression.isClockPaused()).toBe(false);
    expect(event).not.toHaveProperty('choices');
  });

  it('does not respawn a collected seed and preserves progression after death', () => {
    const progression = new ProgressionSystem(planSeedAnchors(5), {
      unlockPack: () => 1,
    });
    const waterCell = progression.getSeedCell('water');
    progression.collectAt(waterCell);
    const beforeDeath = progression.snapshot();

    expect(progression.collectAt(waterCell)).toBeNull();
    expect(progression.notifyDeath()).toEqual(beforeDeath);
    expect(progression.hasCollected('water')).toBe(true);
  });
});
