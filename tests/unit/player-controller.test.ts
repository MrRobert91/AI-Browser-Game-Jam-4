import { describe, expect, it, vi } from 'vitest';
import * as rapier from '@dimforge/rapier3d-compat';
import { PerspectiveCamera } from 'three';

import {
  BRAKING_METERS_PER_SECOND_SQUARED,
  JUMP_HEIGHT_METERS,
  JUMP_SPEED_METERS_PER_SECOND,
  MAX_SLOPE_DEGREES,
  RUN_SPEED_METERS_PER_SECOND,
  WALK_SPEED_METERS_PER_SECOND,
  approachPlanarVelocity,
  configureCharacterController,
  PlayerController,
} from '../../src/player/controller';
import { movementIntentFromKeys } from '../../src/player/input';

describe('player movement contract', () => {
  it('normalizes diagonal WASD and arrow input', () => {
    const wasd = movementIntentFromKeys(new Set(['KeyW', 'KeyD', 'ShiftLeft']));
    const arrows = movementIntentFromKeys(
      new Set(['ArrowUp', 'ArrowRight', 'ShiftRight']),
    );
    expect(wasd).toEqual(arrows);
    expect(Math.hypot(wasd.x, wasd.forward)).toBeCloseTo(1);
    expect(wasd.sprint).toBe(true);
  });

  it('uses normative walk/run speeds and a 1.1 m ballistic jump', () => {
    expect(WALK_SPEED_METERS_PER_SECOND).toBe(4.2);
    expect(RUN_SPEED_METERS_PER_SECOND).toBe(6.2);
    expect(JUMP_SPEED_METERS_PER_SECOND ** 2 / (2 * 22)).toBeCloseTo(
      JUMP_HEIGHT_METERS,
      12,
    );
  });

  it('brakes quickly enough to preserve evasive control', () => {
    let velocity = { x: RUN_SPEED_METERS_PER_SECOND, z: 0 };
    for (let frame = 0; frame < 12; frame += 1) {
      velocity = approachPlanarVelocity(velocity, { x: 0, z: 0 }, 1 / 60);
    }
    expect(BRAKING_METERS_PER_SECOND_SQUARED).toBe(36);
    expect(velocity).toEqual({ x: 0, z: 0 });
  });

  it('configures Rapier for collision sliding and 38 degree slopes', () => {
    const controller = {
      setSlideEnabled: vi.fn(),
      enableAutostep: vi.fn(),
      enableSnapToGround: vi.fn(),
      setMaxSlopeClimbAngle: vi.fn(),
      setMinSlopeSlideAngle: vi.fn(),
      setApplyImpulsesToDynamicBodies: vi.fn(),
    };
    configureCharacterController(controller);
    const radians = (MAX_SLOPE_DEGREES * Math.PI) / 180;

    expect(controller.setSlideEnabled).toHaveBeenCalledWith(true);
    expect(controller.setMaxSlopeClimbAngle).toHaveBeenCalledWith(radians);
    expect(controller.setMinSlopeSlideAngle).toHaveBeenCalledWith(radians);
    expect(controller.enableSnapToGround).toHaveBeenCalledWith(0.2);
  });

  it('uses the Rapier capsule to stop before a fixed wall', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await rapier.init();
    warn.mockRestore();
    const world = new rapier.World({ x: 0, y: -22, z: 0 });
    const ground = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(64, -0.1, 64),
    );
    world.createCollider(rapier.ColliderDesc.cuboid(8, 0.1, 8), ground);
    const wall = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(65, 1, 64),
    );
    world.createCollider(rapier.ColliderDesc.cuboid(0.1, 1, 4), wall);
    const camera = new PerspectiveCamera();
    const input = {
      paused: false,
      settings: {
        mouseSensitivity: 0.002,
        invertY: false,
        headBobEnabled: false,
      },
      movementIntent: () => ({ x: 1, forward: 0, sprint: true }),
      consumeLookDelta: () => ({ x: 0, y: 0 }),
      consumeJump: () => false,
    };
    const controller = new PlayerController(world, camera, input, rapier);

    for (let frame = 0; frame < 120; frame += 1) controller.update(1 / 60);
    expect(camera.position.x).toBeLessThan(64.56);
    expect(controller.grounded).toBe(true);

    controller.dispose();
    world.free();
  });
});
