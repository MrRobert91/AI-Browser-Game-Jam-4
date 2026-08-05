import { describe, expect, it } from 'vitest';

import {
  UNCERTAINTY_GAZE_GRACE_SECONDS,
  UNCERTAINTY_PETRIFY_SECONDS,
  UNCERTAINTY_REWARD_SECONDS,
  UncertaintySystem,
  type UncertaintySpawnCandidate,
} from '../../src/gameplay/uncertainty-enemy';

function candidate(
  id: number,
  overrides: Partial<UncertaintySpawnCandidate> = {},
): UncertaintySpawnCandidate {
  return {
    id,
    cellId: 1_000 + id,
    distanceFromOriginMeters: 53,
    distanceFromPlayerMeters: 12,
    fixedCells: 60,
    stormGuardian: false,
    ...overrides,
  };
}

describe('UncertaintySystem', () => {
  it('enforces spawn distance, fixed-cell onboarding, global and guardian limits', () => {
    const system = new UncertaintySystem();
    expect(system.spawn(candidate(1, { fixedCells: 59 }))).toBeNull();
    expect(
      system.spawn(candidate(1, { distanceFromOriginMeters: 17.9 })),
    ).toBeNull();
    expect(
      system.spawn(candidate(1, { distanceFromPlayerMeters: 7.9 })),
    ).toBeNull();

    expect(system.spawn(candidate(1, { stormGuardian: true }))).not.toBeNull();
    expect(system.spawn(candidate(2, { stormGuardian: true }))).not.toBeNull();
    expect(system.spawn(candidate(3, { stormGuardian: true }))).toBeNull();
    expect(system.spawn(candidate(3))).not.toBeNull();
    expect(system.spawn(candidate(4))).not.toBeNull();
    expect(system.spawn(candidate(5))).toBeNull();
  });

  it('never moves while observed and petrifies with one +3 second reward', () => {
    const system = new UncertaintySystem();
    system.spawn(candidate(1));
    const first = system.update(1, {
      deltaSeconds: UNCERTAINTY_PETRIFY_SECONDS / 2,
      observedInCentralCone: true,
      playerContact: false,
      neighbors: [{ cellId: 2_000, walkable: true, visible: false }],
    });
    expect(first).toEqual([]);
    expect(system.get(1)).toMatchObject({ cellId: 1_001, state: 'SEEN' });

    const fixed = system.update(1, {
      deltaSeconds: UNCERTAINTY_PETRIFY_SECONDS / 2,
      observedInCentralCone: true,
      playerContact: false,
      neighbors: [{ cellId: 2_000, walkable: true, visible: false }],
    });
    expect(fixed).toEqual([
      {
        type: 'FIXED_STATUE',
        id: 1,
        rewardSeconds: UNCERTAINTY_REWARD_SECONDS,
      },
    ]);
    expect(
      system.update(1, {
        deltaSeconds: 2,
        observedInCentralCone: true,
        playerContact: false,
        neighbors: [],
      }),
    ).toEqual([]);
  });

  it('keeps gaze progress for 0.4 seconds, then stalks unseen cells or kills on contact', () => {
    const system = new UncertaintySystem();
    system.spawn(candidate(1));
    system.update(1, {
      deltaSeconds: 0.5,
      observedInCentralCone: true,
      playerContact: false,
      neighbors: [],
    });
    system.update(1, {
      deltaSeconds: UNCERTAINTY_GAZE_GRACE_SECONDS - 0.01,
      observedInCentralCone: false,
      playerContact: false,
      neighbors: [{ cellId: 2_000, walkable: true, visible: false }],
    });
    expect(system.get(1)?.gazeProgressSeconds).toBe(0.5);

    const moved = system.update(1, {
      deltaSeconds: 0.5,
      observedInCentralCone: false,
      playerContact: false,
      neighbors: [
        { cellId: 2_000, walkable: true, visible: false },
        { cellId: 2_001, walkable: true, visible: true },
      ],
    });
    expect(moved).toEqual([
      { type: 'MOVED', id: 1, fromCellId: 1_001, toCellId: 2_000 },
    ]);
    expect(
      system.update(1, {
        deltaSeconds: 0,
        observedInCentralCone: false,
        playerContact: true,
        neighbors: [],
      }),
    ).toEqual([{ type: 'PLAYER_DEATH', id: 1 }]);
  });
});
