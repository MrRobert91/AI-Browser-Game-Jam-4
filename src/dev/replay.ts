import type { ObservationInput } from '../contracts/messages';
import type { UnlockablePackId } from '../contracts/tiles';
import type { WorldVector3 } from '../contracts/world';
import { SolverCore } from '../wfc/solver-core';
import { hashFinalWorld } from '../wfc/rng';

export type ReplayEvent =
  'DEATH' | 'UNLOCK_WATER' | 'UNLOCK_FOREST' | 'UNLOCK_RUIN' | 'UNLOCK_STORM';

export interface ReplayFrame {
  readonly tick: number;
  readonly positionQ: WorldVector3;
  readonly forwardQ: WorldVector3;
  readonly events: readonly ReplayEvent[];
}

export interface HeadlessReplayResult {
  readonly worldSeed: number;
  readonly hash: number;
  readonly collapseCount: number;
  readonly maximumCommitDistanceMeters: number;
  readonly emptyDomains: number;
  readonly quantumVoidDebugCount: number;
  readonly fallbackCount: number;
}

const UNLOCK_EVENT: Readonly<Partial<Record<ReplayEvent, UnlockablePackId>>> = {
  UNLOCK_WATER: 'water',
  UNLOCK_FOREST: 'forest',
  UNLOCK_RUIN: 'ruin',
  UNLOCK_STORM: 'storm',
};

function quantize(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalize(vector: WorldVector3): WorldVector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export class ReplayRecorder {
  private readonly frames: ReplayFrame[] = [];
  private lastTick = -1;

  record(
    tick: number,
    position: WorldVector3,
    forward: WorldVector3,
    events: readonly ReplayEvent[] = [],
  ): ReplayFrame | null {
    if (!Number.isInteger(tick) || tick < 0 || tick <= this.lastTick)
      return null;
    this.lastTick = tick;
    const normalizedForward = normalize(forward);
    const frame: ReplayFrame = {
      tick,
      positionQ: position.map(quantize) as [number, number, number],
      forwardQ: normalizedForward.map(quantize) as [number, number, number],
      events: [...events],
    };
    this.frames.push(frame);
    return frame;
  }

  snapshot(): readonly ReplayFrame[] {
    return this.frames.map((frame) => ({
      ...frame,
      events: [...frame.events],
    }));
  }
}

function visibleCells(frame: ReplayFrame): ObservationInput['visibleCells'] {
  const centerX = Math.floor(frame.positionQ[0] / 2);
  const centerZ = Math.floor(frame.positionQ[2] / 2);
  const cells: ObservationInput['visibleCells'][number][] = [];
  for (let z = centerZ - 5; z <= centerZ + 5; z += 1) {
    for (let x = centerX - 5; x <= centerX + 5; x += 1) {
      if (x < 0 || z < 0 || x >= 64 || z >= 64) continue;
      const dx = (x + 0.5) * 2 - frame.positionQ[0];
      const dz = (z + 0.5) * 2 - frame.positionQ[2];
      const distance = Math.hypot(dx, dz);
      if (distance > 10) continue;
      const direction = normalize([dx, -frame.positionQ[1], dz]);
      const dot =
        frame.forwardQ[0] * direction[0] +
        frame.forwardQ[1] * direction[1] +
        frame.forwardQ[2] * direction[2];
      const alignment = Math.min(
        1,
        Math.max(
          0,
          (dot - Math.cos(Math.PI / 6)) / (1 - Math.cos(Math.PI / 6)),
        ),
      );
      cells.push({
        cellId: z * 64 + x,
        distance,
        alignment,
        lineOfSight: alignment > 0,
      });
    }
  }
  return cells;
}

export function playReplayHeadless(
  worldSeed: number,
  frames: readonly ReplayFrame[],
): HeadlessReplayResult {
  const solver = new SolverCore(worldSeed, { now: () => 0 });
  const fixed = new Map<
    number,
    { cellId: number; terrainTileId: number; featureTileId: number | null }
  >();
  let maximumCommitDistanceMeters = 0;
  let fallbackCount = 0;

  for (const frame of frames) {
    for (const event of frame.events) {
      const pack = UNLOCK_EVENT[event];
      if (pack) solver.unlockPack(pack);
    }
    const outputs = solver.simulationTick({
      type: 'OBSERVATION_TICK',
      tick: frame.tick,
      playerPosition: frame.positionQ,
      cameraForward: frame.forwardQ,
      visibleCells: visibleCells(frame),
    });
    for (const output of outputs) {
      if (output.type === 'COLLAPSE') {
        fixed.set(output.cellId, {
          cellId: output.cellId,
          terrainTileId: output.terrainTileId,
          featureTileId: output.featureTileId,
        });
        const x = ((output.cellId % 64) + 0.5) * 2;
        const z = (Math.floor(output.cellId / 64) + 0.5) * 2;
        maximumCommitDistanceMeters = Math.max(
          maximumCommitDistanceMeters,
          Math.hypot(x - frame.positionQ[0], z - frame.positionQ[2]),
        );
      } else if (output.type === 'SOLVER_WARNING') {
        if (output.code === 'QUANTUM_FALLBACK') fallbackCount += 1;
      }
    }
  }
  const diagnostics = solver.diagnostics;
  return {
    worldSeed,
    hash: hashFinalWorld(worldSeed, [...fixed.values()]),
    collapseCount: fixed.size,
    maximumCommitDistanceMeters,
    emptyDomains: diagnostics.emptyDomains,
    quantumVoidDebugCount: diagnostics.quantumVoidDebugCount,
    fallbackCount,
  };
}

export type SyntheticRoute =
  'straight' | 'spiral' | 'zigzag' | 'still' | 'random';

export function createSyntheticReplay(
  worldSeed: number,
  ticks = 600,
  route: SyntheticRoute = 'spiral',
): readonly ReplayFrame[] {
  const recorder = new ReplayRecorder();
  let randomState = worldSeed >>> 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const t = tick / 10;
    let x = 64;
    let z = 64;
    if (route === 'straight') x += Math.min(48, t * 1.6);
    else if (route === 'spiral') {
      const radius = Math.min(48, 2 + t * 0.8);
      x += Math.cos(t * 0.35) * radius;
      z += Math.sin(t * 0.35) * radius;
    } else if (route === 'zigzag') {
      x += Math.min(44, t * 1.2);
      z += Math.sin(t * 0.9) * 8;
    } else if (route === 'random') {
      randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
      x += ((randomState & 0xffff) / 0xffff - 0.5) * 42;
      z += ((randomState >>> 16) / 0xffff - 0.5) * 42;
    }
    const angle = route === 'still' ? 0 : t * 0.35 + 0.4;
    const events: ReplayEvent[] = [];
    if (tick === 100) events.push('UNLOCK_WATER');
    if (tick === 200) events.push('UNLOCK_FOREST');
    if (tick === 300) events.push('UNLOCK_RUIN');
    if (tick === 400) events.push('UNLOCK_STORM');
    recorder.record(
      tick,
      [Math.min(126, Math.max(2, x)), 1.7, Math.min(126, Math.max(2, z))],
      [Math.cos(angle), -0.1, Math.sin(angle)],
      events,
    );
  }
  return recorder.snapshot();
}
