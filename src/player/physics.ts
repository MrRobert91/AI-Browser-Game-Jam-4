import type { PerspectiveCamera } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';

import { PlayerController } from './controller';
import type { PlayerInput } from './input';
import { createWorldBoundaryColliders } from '../world/world-boundary';

export interface PlayerPhysicsRuntime {
  readonly controller: PlayerController;
  activatePrologueRoom(): void;
  openProloguePortal(): void;
  deactivatePrologueRoom(): void;
  dispose(): void;
}

export async function createPlayerPhysicsRuntime(
  camera: PerspectiveCamera,
  input: PlayerInput,
): Promise<PlayerPhysicsRuntime> {
  const rapier = await import('@dimforge/rapier3d-compat');
  await initializeRapierWithoutLegacyWarning(rapier.init);
  const world = new rapier.World({ x: 0, y: -22, z: 0 });
  const groundBody = world.createRigidBody(
    rapier.RigidBodyDesc.fixed().setTranslation(64, -0.1, 64),
  );
  world.createCollider(
    rapier.ColliderDesc.cuboid(64, 0.1, 64).setFriction(0.8),
    groundBody,
  );
  createWorldBoundaryColliders(world, rapier);
  const controller = new PlayerController(world, camera, input, rapier);
  const roomColliders: Collider[] = [];
  let portalBarrier: Collider | null = null;

  const removeRoomCollider = (collider: Collider): void => {
    world.removeCollider(collider, true);
  };

  const activatePrologueRoom = (): void => {
    if (roomColliders.length > 0) return;
    const wall = (
      halfX: number,
      halfY: number,
      halfZ: number,
      x: number,
      y: number,
      z: number,
    ): Collider =>
      world.createCollider(
        rapier.ColliderDesc.cuboid(halfX, halfY, halfZ).setTranslation(x, y, z),
      );
    roomColliders.push(
      wall(0.15, 2.25, 6, 57, 2.25, 64),
      wall(0.15, 2.25, 6, 71, 2.25, 64),
      wall(7, 2.25, 0.15, 64, 2.25, 70),
      wall(2.25, 2.25, 0.15, 59.25, 2.25, 58),
      wall(2.25, 2.25, 0.15, 68.75, 2.25, 58),
    );
    portalBarrier = wall(2.5, 2.25, 0.15, 64, 2.25, 58);
    roomColliders.push(portalBarrier);
  };

  const openProloguePortal = (): void => {
    if (!portalBarrier) return;
    removeRoomCollider(portalBarrier);
    const index = roomColliders.indexOf(portalBarrier);
    if (index >= 0) roomColliders.splice(index, 1);
    portalBarrier = null;
  };

  const deactivatePrologueRoom = (): void => {
    for (const collider of roomColliders.splice(0))
      removeRoomCollider(collider);
    portalBarrier = null;
  };

  return {
    controller,
    activatePrologueRoom,
    openProloguePortal,
    deactivatePrologueRoom,
    dispose: () => {
      deactivatePrologueRoom();
      controller.dispose();
      world.free();
    },
  };
}

async function initializeRapierWithoutLegacyWarning(
  initialize: () => Promise<void>,
): Promise<void> {
  const previousWarn = console.warn;
  console.warn = (...values: unknown[]) => {
    if (
      values.length === 1 &&
      values[0] ===
        'using deprecated parameters for the initialization function; pass a single object instead'
    ) {
      return;
    }
    previousWarn(...values);
  };
  try {
    await initialize();
  } finally {
    console.warn = previousWarn;
  }
}
