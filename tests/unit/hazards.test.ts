import { describe, expect, it } from 'vitest';

import {
  CRYSTAL_PULSE_SECONDS,
  FRAGILE_BREAK_DELAY_SECONDS,
  HAZARD_PHYSICS_ENABLE_PROGRESS,
  HazardSystem,
  canPlaceHazard,
  type HazardPlacementCandidate,
  type HazardType,
} from '../../src/gameplay/hazards';

function candidate(
  type: HazardType,
  overrides: Partial<HazardPlacementCandidate> = {},
): HazardPlacementCandidate {
  return {
    cellId: 400,
    type,
    distanceFromOriginMeters: 40,
    distanceFromPlayerMeters: 8,
    onReservedAnchor: false,
    onSafeCorridor: false,
    hasSafeWaterExit: true,
    unlockedPacks: new Set(['water', 'storm']),
    ...overrides,
  };
}

describe('HazardSystem', () => {
  it('never places danger under the player, near origin, or on protected paths', () => {
    expect(
      canPlaceHazard(candidate('SPIKES', { distanceFromPlayerMeters: 2.5 })),
    ).toBe(false);
    expect(
      canPlaceHazard(candidate('SPIKES', { distanceFromPlayerMeters: 3.9 })),
    ).toBe(false);
    expect(
      canPlaceHazard(candidate('SPIKES', { distanceFromOriginMeters: 14 })),
    ).toBe(false);
    expect(canPlaceHazard(candidate('SPIKES', { onSafeCorridor: true }))).toBe(
      false,
    );
    expect(
      canPlaceHazard(candidate('SPIKES', { onReservedAnchor: true })),
    ).toBe(false);
  });

  it('requires a nearby safe transition for deep water', () => {
    expect(
      canPlaceHazard(candidate('DEEP_WATER', { hasSafeWaterExit: false })),
    ).toBe(false);
    expect(canPlaceHazard(candidate('DEEP_WATER'))).toBe(true);
  });

  it('activates physics only after 70 percent and runs timed hazards safely', () => {
    const system = new HazardSystem(true);
    const crystal = system.place(candidate('CHARGED_CRYSTAL'), 0);
    expect(crystal).not.toBeNull();
    expect(
      system.setCollapseProgress(400, HAZARD_PHYSICS_ENABLE_PROGRESS - 0.01),
    ).toBe(false);
    expect(
      system.setCollapseProgress(400, HAZARD_PHYSICS_ENABLE_PROGRESS),
    ).toBe(true);
    expect(system.update(CRYSTAL_PULSE_SECONDS, new Set([400]))).toContainEqual(
      {
        type: 'CRYSTAL_PULSE',
        cellId: 400,
        visualMode: 'SOFT_DISSOLVE',
      },
    );

    const fragile = new HazardSystem(false);
    fragile.place(candidate('FRAGILE_GROUND', { cellId: 401 }), 0);
    fragile.setCollapseProgress(401, 1);
    expect(
      fragile.update(FRAGILE_BREAK_DELAY_SECONDS - 0.01, new Set([401])),
    ).toEqual([]);
    expect(fragile.update(0.01, new Set([401]))).toContainEqual({
      type: 'FRAGILE_BREAK',
      cellId: 401,
    });
  });
});
