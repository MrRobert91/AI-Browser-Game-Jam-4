import { describe, expect, it } from 'vitest';

import {
  ANCHOR_ANGLE_SEPARATION_DEGREES,
  ANCHOR_RINGS,
  angularDistanceDegrees,
  planSeedAnchors,
} from '../../src/gameplay/anchors';

describe('macro seed anchor planner', () => {
  it('keeps four deterministic anchors in their rings and at least 55 degrees apart', () => {
    for (let worldSeed = 0; worldSeed < 100; worldSeed += 1) {
      const first = planSeedAnchors(worldSeed);
      const second = planSeedAnchors(worldSeed);
      expect(second).toEqual(first);
      expect(first.anchors).toHaveLength(4);

      first.anchors.forEach((anchor, index) => {
        const ring = ANCHOR_RINGS[index]!;
        expect(anchor.packId).toBe(ring.packId);
        expect(anchor.distanceMeters).toBeGreaterThanOrEqual(
          ring.minimumMeters,
        );
        expect(anchor.distanceMeters).toBeLessThanOrEqual(ring.maximumMeters);
        expect(anchor.reservedCellIds).toHaveLength(9);
        expect(anchor.corridorCellIds.length).toBeGreaterThan(2);
      });

      for (let left = 0; left < first.anchors.length; left += 1) {
        for (let right = left + 1; right < first.anchors.length; right += 1) {
          expect(
            angularDistanceDegrees(
              first.anchors[left]!.angleDegrees,
              first.anchors[right]!.angleDegrees,
            ),
          ).toBeGreaterThanOrEqual(ANCHOR_ANGLE_SEPARATION_DEGREES);
        }
      }
    }
  });

  it('reserves a continuous two-cell corridor without deep water or spikes', () => {
    const forbidden = new Set<number>();
    const plan = planSeedAnchors(0xa91f42c0, {
      isCorridorCellSafe: (cellId) => !forbidden.has(cellId),
    });

    for (const anchor of plan.anchors) {
      expect(anchor.usedFallbackMeadow).toBe(false);
      for (const cellId of anchor.corridorCellIds) {
        expect(forbidden.has(cellId)).toBe(false);
      }
    }
  });

  it('falls back to a 3 x 3 Meadow reservation after three failed attempts', () => {
    const plan = planSeedAnchors(7, { isCorridorCellSafe: () => false });
    for (const anchor of plan.anchors) {
      expect(anchor.attempts).toBe(3);
      expect(anchor.usedFallbackMeadow).toBe(true);
      expect(anchor.fallbackMeadowCellIds).toEqual(anchor.reservedCellIds);
    }
  });
});
