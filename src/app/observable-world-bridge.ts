import type {
  ChunkBoundaryEvent,
  SolverWarning,
  WorkerOutput,
} from '../contracts/messages';
import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId, WorldVector3 } from '../contracts/world';
import {
  CollapseDirector,
  type CollapsePhysicsAdapter,
  type CollapseVisualAdapter,
} from '../world/collapse-director';
import {
  ObservationSystem,
  type LineOfSightTest,
  type ObservationFrame,
} from '../world/observation-system';
import { WorldState } from '../world/world-state';
import type {
  ObservationTickData,
  SolverWorkerClient,
} from './solver-worker-client';

export interface ObservableSolverClient {
  sendObservation(data: ObservationTickData): number;
  sendUnlockPack(packId: UnlockablePackId): number;
  reset(worldSeed: number): number;
}

export interface ObservableWorldBridgeOptions {
  readonly solver: ObservableSolverClient | SolverWorkerClient;
  readonly getPlayerPosition: () => WorldVector3;
  readonly lineOfSight?: LineOfSightTest;
  readonly visuals?: CollapseVisualAdapter;
  readonly physics?: CollapsePhysicsAdapter;
  readonly safeTerrainTileId?: number;
  readonly onWarning?: (warning: SolverWarning) => void;
  readonly onCollapseAccepted?: (cellId: CellId) => void;
  readonly worldState?: WorldState;
}

function boundarySignature(event: ChunkBoundaryEvent): string {
  return [
    event.chunkId,
    ...event.north,
    ...event.east,
    ...event.south,
    ...event.west,
  ].join(':');
}

function collapseSignature(
  output: Extract<WorkerOutput, { type: 'COLLAPSE' }>,
): string {
  return [
    output.cellId,
    output.terrainTileId,
    output.featureTileId ?? -1,
    output.worldSeed,
  ].join(':');
}

/** Main-thread integration point; no worker internals cross this boundary. */
export class ObservableWorldBridge {
  readonly worldState: WorldState;
  readonly observation: ObservationSystem;
  readonly collapses: CollapseDirector;

  private paletteEpoch = 0;
  private readonly unlockedPacks = new Set<UnlockablePackId>();
  private readonly boundaries = new Map<number, ChunkBoundaryEvent>();
  private readonly seenCollapseEvents = new Set<string>();
  private readonly seenBoundaryEvents = new Set<string>();

  constructor(private readonly options: ObservableWorldBridgeOptions) {
    this.worldState = options.worldState ?? new WorldState();
    this.observation = new ObservationSystem(
      this.worldState,
      options.lineOfSight,
      () => this.paletteEpoch,
    );
    this.collapses = new CollapseDirector(
      this.worldState,
      options.visuals,
      options.physics,
    );
  }

  update(frame: ObservationFrame, nowMs: number): number {
    let emitted = 0;
    for (const result of this.observation.update(frame)) {
      this.collapses.ensureSafeContactGround(
        result.contactCellIds,
        this.options.safeTerrainTileId ?? 0,
      );
      this.options.solver.sendObservation({
        playerPosition: result.input.playerPosition,
        cameraForward: result.input.cameraForward,
        visibleCells: result.input.visibleCells,
      });
      emitted += 1;
    }
    this.collapses.update(nowMs);
    return emitted;
  }

  handleWorkerOutput(output: WorkerOutput, nowMs: number): boolean {
    if (output.type === 'SOLVER_WARNING') {
      this.options.onWarning?.(output);
      return true;
    }

    if (output.type === 'BOUNDARY_UPDATE') {
      const signature = boundarySignature(output);
      if (this.seenBoundaryEvents.has(signature)) {
        return false;
      }
      this.seenBoundaryEvents.add(signature);
      this.boundaries.set(output.chunkId, {
        ...output,
        north: output.north.slice(),
        east: output.east.slice(),
        south: output.south.slice(),
        west: output.west.slice(),
      });
      return true;
    }

    const signature = collapseSignature(output);
    if (this.seenCollapseEvents.has(signature)) {
      return false;
    }
    const accepted = this.collapses.accept(
      output,
      this.options.getPlayerPosition(),
      nowMs,
    );
    if (accepted) {
      this.seenCollapseEvents.add(signature);
      this.options.onCollapseAccepted?.(output.cellId);
    }
    return accepted;
  }

  unlockPack(packId: UnlockablePackId): number {
    if (!this.unlockedPacks.has(packId)) {
      this.unlockedPacks.add(packId);
      this.paletteEpoch += 1;
      this.options.solver.sendUnlockPack(packId);
    }
    return this.paletteEpoch;
  }

  reset(worldSeed: number): number {
    this.observation.reset();
    return this.options.solver.reset(worldSeed);
  }

  getPaletteEpoch(): number {
    return this.paletteEpoch;
  }

  getBoundary(chunkId: number): ChunkBoundaryEvent | null {
    return this.boundaries.get(chunkId) ?? null;
  }

  getNearbyCellIds(position: WorldVector3, radiusCells = 6): readonly CellId[] {
    const centerX = Math.floor(position[0] / 2);
    const centerZ = Math.floor(position[2] / 2);
    const ids: CellId[] = [];
    for (let z = centerZ - radiusCells; z <= centerZ + radiusCells; z += 1) {
      for (let x = centerX - radiusCells; x <= centerX + radiusCells; x += 1) {
        if (x >= 0 && z >= 0 && x < 64 && z < 64) {
          ids.push(z * 64 + x);
        }
      }
    }
    return ids;
  }
}
