import type { PerspectiveCamera } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';

import { PlayerController } from './controller';
import type { PlayerInput } from './input';
import { createWorldBoundaryColliders } from '../world/world-boundary';
import type { CellId } from '../contracts/world';
import type { FixedCellCommit } from '../world/world-state';
import { cellCenterToWorld } from '../world/world-state';
import { GRAMMAR_SOURCE } from '../content/grammar';

export const SMALL_ROCK_COLLIDER_WIDTH_METERS = 1.6;
export const SMALL_ROCK_COLLIDER_HEIGHT_METERS = 0.9;
export const ADJACENT_ROCK_GAP_METERS = 2 - SMALL_ROCK_COLLIDER_WIDTH_METERS;
export const FEATURE_COLLIDER_ACTIVATION_CLEARANCE_METERS = 2.5;
export const ROCK_JUMP_COMMENT_RADIUS_METERS = 2.75;

export function isSafeToActivateFeatureCollider(
  cellId: CellId,
  playerPosition: readonly [number, number, number],
): boolean {
  const center = cellCenterToWorld(cellId);
  return (
    Math.hypot(center[0] - playerPosition[0], center[2] - playerPosition[2]) >
    FEATURE_COLLIDER_ACTIVATION_CLEARANCE_METERS
  );
}

export interface PlayerPhysicsRuntime {
  readonly controller: PlayerController;
  activatePrologueRoom(): void;
  openProloguePortal(): void;
  deactivatePrologueRoom(): void;
  enableFeatureCollider(commit: FixedCellCommit): void;
  updateFeatureColliders(
    playerPosition: readonly [number, number, number],
  ): void;
  consumeRockJump(playerPosition: readonly [number, number, number]): boolean;
  removeFeatureColliders(cellIds: readonly CellId[]): void;
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
  const featureColliders = new Map<CellId, Collider>();
  const featureCommits = new Map<CellId, FixedCellCommit>();
  const pendingSafeActivation = new Set<CellId>();
  const featureById = new Map(
    GRAMMAR_SOURCE.features.map((feature) => [feature.numericId, feature]),
  );

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

  const removeFeatureColliders = (cellIds: readonly CellId[]): void => {
    for (const cellId of cellIds) {
      const collider = featureColliders.get(cellId);
      if (collider) world.removeCollider(collider, true);
      featureColliders.delete(cellId);
      featureCommits.delete(cellId);
      pendingSafeActivation.delete(cellId);
    }
  };

  const enableFeatureCollider = (commit: FixedCellCommit): void => {
    if (commit.featureTileId === null) return;
    const feature = featureById.get(commit.featureTileId);
    if (!feature?.blocksMovement) return;
    featureCommits.set(commit.cellId, commit);
    pendingSafeActivation.add(commit.cellId);
  };

  const createFeatureCollider = (commit: FixedCellCommit): void => {
    if (commit.featureTileId === null || featureColliders.has(commit.cellId))
      return;
    const feature = featureById.get(commit.featureTileId);
    if (!feature?.blocksMovement) return;
    const center = cellCenterToWorld(commit.cellId);
    const isBomb = feature.id === 'feature.consciousness-bomb';
    const isRock = feature.id === 'feature.small-rock';
    const isTree = feature.tags.includes('tree');
    const isRuin = feature.tags.some((tag) =>
      ['arch', 'column', 'wall', 'statue'].includes(tag),
    );
    const descriptor = (
      isRock
        ? rapier.ColliderDesc.cuboid(
            Math.max(0.75, SMALL_ROCK_COLLIDER_WIDTH_METERS / 2),
            Math.max(0.7, SMALL_ROCK_COLLIDER_HEIGHT_METERS / 2),
            Math.max(0.75, SMALL_ROCK_COLLIDER_WIDTH_METERS / 2),
          ).setTranslation(
            center[0],
            Math.max(0.7, SMALL_ROCK_COLLIDER_HEIGHT_METERS / 2),
            center[2],
          )
        : isTree
          ? rapier.ColliderDesc.cylinder(3, 0.45).setTranslation(
              center[0],
              3,
              center[2],
            )
          : isRuin
            ? rapier.ColliderDesc.cuboid(0.9, 2.5, 0.45).setTranslation(
                center[0],
                2.5,
                center[2],
              )
            : rapier.ColliderDesc.cuboid(0.62, 0.85, 0.62).setTranslation(
                center[0],
                0.85,
                center[2],
              )
    ).setFriction(0.8);
    if (isBomb) descriptor.setSensor(true);
    featureColliders.set(commit.cellId, world.createCollider(descriptor));
  };

  const updateFeatureColliders = (
    playerPosition: readonly [number, number, number],
  ): void => {
    for (const [cellId, commit] of featureCommits) {
      const center = cellCenterToWorld(cellId);
      const near =
        Math.hypot(
          center[0] - playerPosition[0],
          center[2] - playerPosition[2],
        ) <= 12;
      if (near) {
        if (
          pendingSafeActivation.has(cellId) &&
          !isSafeToActivateFeatureCollider(cellId, playerPosition)
        ) {
          continue;
        }
        createFeatureCollider(commit);
        pendingSafeActivation.delete(cellId);
      } else {
        const collider = featureColliders.get(cellId);
        if (!collider) continue;
        world.removeCollider(collider, true);
        featureColliders.delete(cellId);
      }
    }
  };

  const consumeRockJump = (
    playerPosition: readonly [number, number, number],
  ): boolean => {
    if (!controller.consumeJumpStarted()) return false;
    for (const commit of featureCommits.values()) {
      if (commit.featureTileId === null) continue;
      const feature = featureById.get(commit.featureTileId);
      if (feature?.id !== 'feature.small-rock') continue;
      const center = cellCenterToWorld(commit.cellId);
      if (
        Math.hypot(
          center[0] - playerPosition[0],
          center[2] - playerPosition[2],
        ) <= ROCK_JUMP_COMMENT_RADIUS_METERS
      ) {
        return true;
      }
    }
    return false;
  };

  return {
    controller,
    activatePrologueRoom,
    openProloguePortal,
    deactivatePrologueRoom,
    enableFeatureCollider,
    updateFeatureColliders,
    consumeRockJump,
    removeFeatureColliders,
    dispose: () => {
      deactivatePrologueRoom();
      removeFeatureColliders([...featureColliders.keys()]);
      featureCommits.clear();
      pendingSafeActivation.clear();
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
