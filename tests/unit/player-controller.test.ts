import { describe, expect, it, vi } from 'vitest';
import * as rapier from '@dimforge/rapier3d-compat';
import { PerspectiveCamera } from 'three';

import {
  BRAKING_METERS_PER_SECOND_SQUARED,
  JUMP_HEIGHT_METERS,
  JUMP_SPEED_METERS_PER_SECOND,
  MAX_SLOPE_DEGREES,
  PLAYER_CAPSULE_CENTER_HEIGHT_METERS,
  PLAYER_MAX_CENTER_RADIUS_METERS,
  RUN_SPEED_METERS_PER_SECOND,
  WALK_SPEED_METERS_PER_SECOND,
  approachPlanarVelocity,
  configureCharacterController,
  constrainPlayerTranslation,
  PlayerController,
} from '../../src/player/controller';
import { movementIntentFromKeys } from '../../src/player/input';
import {
  ADJACENT_ROCK_GAP_METERS,
  FEATURE_COLLIDER_ACTIVATION_CLEARANCE_METERS,
  SMALL_ROCK_COLLIDER_HEIGHT_METERS,
  isSafeToActivateFeatureCollider,
} from '../../src/player/physics';
import {
  WORLD_BOUNDARY_RADIUS_METERS,
  WORLD_CENTER_METERS,
  createWorldBoundaryColliders,
} from '../../src/world/world-boundary';

describe('player movement contract', () => {
  it('makes adjacent rocks too narrow to pass but low enough to jump', () => {
    expect(ADJACENT_ROCK_GAP_METERS).toBeLessThan(0.7);
    expect(SMALL_ROCK_COLLIDER_HEIGHT_METERS).toBeLessThan(JUMP_HEIGHT_METERS);
  });

  it('defers a newly collapsed rigid feature until the player clears its cell', () => {
    const cellId = 32 * 64 + 32;
    expect(isSafeToActivateFeatureCollider(cellId, [65, 1.7, 65])).toBe(false);
    expect(
      isSafeToActivateFeatureCollider(cellId, [
        65 + FEATURE_COLLIDER_ACTIVATION_CLEARANCE_METERS + 0.01,
        1.7,
        65,
      ]),
    ).toBe(true);
  });
  it('normalizes diagonal WASD and arrow input', () => {
    const wasd = movementIntentFromKeys(new Set(['KeyW', 'KeyD', 'ShiftLeft']));
    const arrows = movementIntentFromKeys(
      new Set(['ArrowUp', 'ArrowRight', 'ShiftRight']),
    );
    expect(wasd).toEqual(arrows);
    expect(Math.hypot(wasd.x, wasd.forward)).toBeCloseTo(1);
    expect(wasd.sprint).toBe(true);
  });

  it('uses the reduced walk/run speeds and a 1.1 m ballistic jump', () => {
    expect(WALK_SPEED_METERS_PER_SECOND).toBe(2.52);
    expect(RUN_SPEED_METERS_PER_SECOND).toBe(3.72);
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

  it('recovers invalid translations without leaving the floor or dome', () => {
    const recovered = constrainPlayerTranslation({
      x: WORLD_CENTER_METERS + 100,
      y: -50,
      z: WORLD_CENTER_METERS + 100,
    });

    expect(recovered.y).toBe(PLAYER_CAPSULE_CENTER_HEIGHT_METERS);
    expect(
      Math.hypot(
        recovered.x - WORLD_CENTER_METERS,
        recovered.z - WORLD_CENTER_METERS,
      ),
    ).toBeCloseTo(PLAYER_MAX_CENTER_RADIUS_METERS, 12);
  });

  it('slides tangentially while rejecting outward movement at the dome', () => {
    const requested = {
      x: WORLD_CENTER_METERS + PLAYER_MAX_CENTER_RADIUS_METERS + 0.5,
      y: PLAYER_CAPSULE_CENTER_HEIGHT_METERS,
      z: WORLD_CENTER_METERS + 0.5,
    };
    const constrained = constrainPlayerTranslation(requested);

    expect(constrained.x).toBeLessThan(requested.x);
    expect(constrained.z).toBeGreaterThan(WORLD_CENTER_METERS);
    expect(
      Math.hypot(
        constrained.x - WORLD_CENTER_METERS,
        constrained.z - WORLD_CENTER_METERS,
      ),
    ).toBeCloseTo(PLAYER_MAX_CENTER_RADIUS_METERS, 12);
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

  it('cannot cross the wide spherical world boundary', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await rapier.init();
    warn.mockRestore();
    const world = new rapier.World({ x: 0, y: -22, z: 0 });
    const ground = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(64, -0.1, 64),
    );
    world.createCollider(rapier.ColliderDesc.cuboid(64, 0.1, 64), ground);
    createWorldBoundaryColliders(world, rapier);
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
    controller.respawn({ x: 124.5, y: 0.85, z: WORLD_CENTER_METERS });

    for (let frame = 0; frame < 180; frame += 1) controller.update(1 / 60);
    const distance = Math.hypot(
      camera.position.x - WORLD_CENTER_METERS,
      camera.position.z - WORLD_CENTER_METERS,
    );
    expect(distance).toBeLessThan(WORLD_BOUNDARY_RADIUS_METERS);

    controller.dispose();
    world.free();
  });

  it('cannot cross the dome at cardinal or diagonal seams', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await rapier.init();
    warn.mockRestore();

    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const world = new rapier.World({ x: 0, y: -22, z: 0 });
      const ground = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(64, -0.1, 64),
      );
      world.createCollider(rapier.ColliderDesc.cuboid(64, 0.1, 64), ground);
      createWorldBoundaryColliders(world, rapier);
      const camera = new PerspectiveCamera();
      camera.rotation.y = angle - Math.PI / 2;
      const input = {
        paused: false,
        settings: {
          mouseSensitivity: 0.002,
          invertY: false,
          headBobEnabled: false,
        },
        movementIntent: () => ({ x: 0, forward: 1, sprint: true }),
        consumeLookDelta: () => ({ x: 0, y: 0 }),
        consumeJump: () => false,
      };
      const controller = new PlayerController(world, camera, input, rapier);
      controller.respawn({
        x: WORLD_CENTER_METERS + Math.cos(angle) * 60.5,
        y: PLAYER_CAPSULE_CENTER_HEIGHT_METERS,
        z: WORLD_CENTER_METERS + Math.sin(angle) * 60.5,
      });

      for (let frame = 0; frame < 180; frame += 1) controller.update(1 / 60);
      expect(
        Math.hypot(
          camera.position.x - WORLD_CENTER_METERS,
          camera.position.z - WORLD_CENTER_METERS,
        ),
      ).toBeLessThanOrEqual(PLAYER_MAX_CENTER_RADIUS_METERS + 1e-9);
      expect(camera.position.y).toBeGreaterThanOrEqual(1.7);

      controller.dispose();
      world.free();
    }
  });
});
