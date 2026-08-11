import { describe, expect, it } from 'vitest';

import {
  OBSERVATION_CHARGE_PER_SECOND,
  OBSERVATION_RADIUS_METERS,
  ObservationSystem,
} from '../../src/world/observation-system';
import {
  WorldState,
  cellCenterToWorld,
  cellCoordinatesToId,
} from '../../src/world/world-state';

describe('ObservationSystem', () => {
  const targetId = cellCoordinatesToId({ x: 32, z: 29 });
  const playerPosition = [65, 1.7, 65] as const;
  const targetPosition = cellCenterToWorld(targetId, 1.7);
  const towardTarget = [
    targetPosition[0] - playerPosition[0],
    0,
    targetPosition[2] - playerPosition[2],
  ] as const;

  it('observes ahead at 20 m and charges at twice the original rate', () => {
    expect(OBSERVATION_RADIUS_METERS).toBe(20);
    expect(OBSERVATION_CHARGE_PER_SECOND).toBe(2.8);
    const world = new WorldState();
    const system = new ObservationSystem(world);
    const aheadId = cellCoordinatesToId({ x: 32, z: 24 });
    const ahead = cellCenterToWorld(aheadId, 1.7);
    const [sample] = system.update({
      deltaSeconds: 0.1,
      playerPosition,
      cameraForward: [
        ahead[0] - playerPosition[0],
        0,
        ahead[2] - playerPosition[2],
      ],
      nearbyCellIds: [aheadId],
    });
    expect(sample?.input.visibleCells.map((cell) => cell.cellId)).toEqual([
      aheadId,
    ]);
    expect(world.getCell(aheadId).observationCharge).toBeGreaterThan(0);
  });

  it('charges a visible cell while looking and decays after turning away', () => {
    const world = new WorldState();
    const system = new ObservationSystem(world);

    system.update({
      deltaSeconds: 0.1,
      playerPosition,
      cameraForward: towardTarget,
      nearbyCellIds: [targetId],
    });
    const charged = world.getCell(targetId).observationCharge;
    expect(charged).toBeGreaterThan(0);

    system.update({
      deltaSeconds: 0.1,
      playerPosition,
      cameraForward: [0, 0, 1],
      nearbyCellIds: [targetId],
    });
    expect(world.getCell(targetId).observationCharge).toBeLessThan(charged);
  });

  it('assigns zero attention through fixed occlusion', () => {
    const world = new WorldState();
    const system = new ObservationSystem(world, () => false);
    const [result] = system.update({
      deltaSeconds: 0.1,
      playerPosition,
      cameraForward: towardTarget,
      nearbyCellIds: [targetId],
    });

    expect(result?.attentionByCell.get(targetId)).toBe(0);
    expect(result?.input.visibleCells[0]?.lineOfSight).toBe(false);
    expect(world.getCell(targetId).observationCharge).toBe(0);
  });

  it('reports contact cells separately and emits solver inputs exactly at 10 Hz', () => {
    const world = new WorldState();
    const contactId = cellCoordinatesToId({ x: 32, z: 32 });
    const system = new ObservationSystem(world);
    const frame = {
      playerPosition,
      cameraForward: [0, 0, -1] as const,
      nearbyCellIds: [contactId],
    };

    expect(system.update({ ...frame, deltaSeconds: 0.099 })).toHaveLength(0);
    const first = system.update({ ...frame, deltaSeconds: 0.001 });
    expect(first).toHaveLength(1);
    expect(first[0]?.input.tick).toBe(1);
    expect(first[0]?.contactCellIds).toEqual([contactId]);
    expect(system.update({ ...frame, deltaSeconds: 0.2 })).toHaveLength(2);
  });
});
