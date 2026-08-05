import type { CollapseEvent } from '../contracts/messages';
import type { CellId, WorldVector3 } from '../contracts/world';
import {
  type FixedCellCommit,
  WorldState,
  cellCenterToWorld,
} from './world-state';

export const MAX_COLLAPSE_COMMIT_DISTANCE_METERS = 10.01;
export const MIN_COLLAPSE_DURATION_MS = 450;
export const MAX_COLLAPSE_DURATION_MS = 700;
export const COLLIDER_ENABLE_PROGRESS = 0.7;

export interface CollapseVisualAdapter {
  begin(event: CollapseEvent, center: WorldVector3, durationMs: number): void;
  update(cellId: CellId, progress: number): void;
  emitBoundaryWave(cellId: CellId): void;
  complete(cellId: CellId): void;
}

export interface CollapsePhysicsAdapter {
  enableFixedCollider(commit: FixedCellCommit): void;
}

interface ActiveCollapse {
  readonly event: CollapseEvent;
  readonly commit: FixedCellCommit;
  readonly startedAtMs: number;
  readonly durationMs: number;
  colliderEnabled: boolean;
}

function horizontalDistance(
  left: WorldVector3,
  right: WorldVector3,
): number {
  return Math.hypot(left[0] - right[0], left[2] - right[2]);
}

function deterministicRotation(event: CollapseEvent): 0 | 1 | 2 | 3 {
  const mixed = Math.imul(event.cellId ^ event.worldSeed, 0x45d9f3b) >>> 0;
  return (mixed % 4) as 0 | 1 | 2 | 3;
}

function clampDuration(durationMs: number): number {
  return Math.min(
    MAX_COLLAPSE_DURATION_MS,
    Math.max(MIN_COLLAPSE_DURATION_MS, durationMs),
  );
}

const NOOP_VISUALS: CollapseVisualAdapter = {
  begin: () => undefined,
  update: () => undefined,
  emitBoundaryWave: () => undefined,
  complete: () => undefined,
};

const NOOP_PHYSICS: CollapsePhysicsAdapter = {
  enableFixedCollider: () => undefined,
};

/**
 * Applies already-committed worker events without ever exposing a candidate
 * that can be rolled back. The player position is sampled when the event is
 * accepted, which is the visual commit instant.
 */
export class CollapseDirector {
  private readonly active = new Map<CellId, ActiveCollapse>();

  constructor(
    private readonly worldState: WorldState,
    private readonly visuals: CollapseVisualAdapter = NOOP_VISUALS,
    private readonly physics: CollapsePhysicsAdapter = NOOP_PHYSICS,
  ) {}

  accept(
    event: CollapseEvent,
    playerPositionAtCommit: WorldVector3,
    nowMs: number,
  ): boolean {
    const center = cellCenterToWorld(event.cellId, playerPositionAtCommit[1]);
    if (
      horizontalDistance(center, playerPositionAtCommit) >
      MAX_COLLAPSE_COMMIT_DISTANCE_METERS
    ) {
      return false;
    }

    const existing = this.worldState.getCell(event.cellId);
    if (existing.phase === 'FIXED') {
      return (
        existing.terrainTileId === event.terrainTileId &&
        existing.featureTileId === event.featureTileId
      );
    }
    if (this.active.has(event.cellId)) {
      return false;
    }

    if (existing.phase === 'UNINITIALIZED') {
      this.worldState.initializeCell(event.cellId);
    }
    this.worldState.setPhase(event.cellId, 'COLLAPSING');

    const durationMs = clampDuration(event.durationMs);
    const commit: FixedCellCommit = {
      cellId: event.cellId,
      terrainTileId: event.terrainTileId,
      featureTileId: event.featureTileId,
      terrainRotationQuarterTurns: deterministicRotation(event),
    };
    this.active.set(event.cellId, {
      event,
      commit,
      startedAtMs: nowMs,
      durationMs,
      colliderEnabled: false,
    });
    this.visuals.begin(event, center, durationMs);
    return true;
  }

  ensureSafeContactGround(
    contactCellIds: readonly CellId[],
    safeTerrainTileId: number,
  ): readonly CellId[] {
    const fixed: CellId[] = [];
    for (const cellId of contactCellIds) {
      const cell = this.worldState.getCell(cellId);
      if (cell.phase === 'FIXED' || this.active.has(cellId)) {
        continue;
      }
      const commit: FixedCellCommit = {
        cellId,
        terrainTileId: safeTerrainTileId,
        featureTileId: null,
        terrainRotationQuarterTurns: 0,
      };
      this.worldState.commitFixed(commit);
      this.physics.enableFixedCollider(commit);
      this.visuals.emitBoundaryWave(cellId);
      this.visuals.complete(cellId);
      fixed.push(cellId);
    }
    return fixed;
  }

  update(nowMs: number): readonly CellId[] {
    const completed: CellId[] = [];
    for (const [cellId, collapse] of this.active) {
      const progress = Math.min(
        1,
        Math.max(0, (nowMs - collapse.startedAtMs) / collapse.durationMs),
      );
      this.visuals.update(cellId, progress);

      if (!collapse.colliderEnabled && progress >= COLLIDER_ENABLE_PROGRESS) {
        this.physics.enableFixedCollider(collapse.commit);
        collapse.colliderEnabled = true;
      }

      if (progress >= 1) {
        this.worldState.commitFixed(collapse.commit);
        this.visuals.emitBoundaryWave(cellId);
        this.visuals.complete(cellId);
        this.active.delete(cellId);
        completed.push(cellId);
      }
    }
    return completed;
  }

  isCollapsing(cellId: CellId): boolean {
    return this.active.has(cellId);
  }
}
