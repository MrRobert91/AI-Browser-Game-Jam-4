import type { PerspectiveCamera } from 'three';

import { PlayerController } from './controller';
import type { PlayerInput } from './input';

export interface PlayerPhysicsRuntime {
  readonly controller: PlayerController;
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
  const controller = new PlayerController(world, camera, input, rapier);

  return {
    controller,
    dispose: () => {
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
