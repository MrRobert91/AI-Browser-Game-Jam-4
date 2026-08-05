import type {
  ChunkBoundaryEvent,
  CollapseEvent,
  ObservationInput,
  SolverWarning,
  WorkerOutput,
} from '../contracts/messages';
import type { UnlockablePackId } from '../contracts/tiles';
import type { CellPhase, WorldVector3 } from '../contracts/world';

import { createFullMask, isEmpty, type MutableDomainMask } from './bitset';
import {
  BOUNDARY_LENGTH,
  UNCONSTRAINED_TILE,
  cloneBoundaryConstraint,
} from './boundary';
import {
  CELL_SIZE_METERS,
  CHUNK_CELLS_PER_SIDE,
  CHUNKS_PER_SIDE,
  ChunkStore,
  WORLD_CELLS_PER_SIDE,
} from './chunk-store';
import {
  observationPriority,
  type ObservationPriorityCandidate,
  type WeightDefinition,
} from './entropy';
import { createRng, deriveSeed, nextFloat01, SIMULATION_TICK_MS } from './rng';
import { attemptObservedCollapse, type TransactionCell } from './transaction';

export const FIXED_TICK_SECONDS = 0.1;
export const MAX_SOLVER_WORK_MS = 4;
export const COMMIT_COOLDOWN_MS = 90;
export const MAX_OBSERVATION_DISTANCE_METERS = 10.01;
export const SAFE_BODY_RADIUS_METERS = 2.5;

const BASE_VARIANT_COUNT = 3;
const QUANTUM_MEADOW_VARIANT = 2;
const MAX_BASE_ENTROPY = Math.log(BASE_VARIANT_COUNT);
const BASE_WEIGHTS: readonly WeightDefinition[] = [
  { weight: 14 },
  { weight: 9 },
  { weight: 1 },
];

class CoreCell implements TransactionCell {
  readonly cellId: number;
  readonly domain: MutableDomainMask = createFullMask(BASE_VARIANT_COUNT);
  entropy = MAX_BASE_ENTROPY;
  phase: CellPhase = 'UNINITIALIZED';
  observationCharge = 0;
  paletteEpoch = 0;
  fixedTerrainId: number | null = null;

  constructor(cellId: number) {
    this.cellId = cellId;
  }

  get fixed(): boolean {
    return this.phase === 'FIXED';
  }
}

interface PendingCollapseWork {
  readonly cellId: number;
  readonly entropyBefore: number;
  readonly distanceAtSchedule: number;
  remainingSteps: number;
}

export interface SolverCoreOptions {
  readonly now?: () => number;
  readonly workBudgetMs?: number;
}

export interface SolverCoreDiagnostics {
  readonly pendingWork: number;
  readonly fixedCells: number;
  readonly emptyDomains: number;
  readonly quantumVoidDebugCount: number;
}

/** Deterministic, render-independent owner of the logical 64x64 world. */
export class SolverCore {
  readonly worldSeed: number;
  readonly #now: () => number;
  readonly #workBudgetMs: number;
  readonly #cells = Array.from(
    { length: WORLD_CELLS_PER_SIDE ** 2 },
    (_, cellId) => new CoreCell(cellId),
  );
  readonly #pendingWork: PendingCollapseWork[] = [];
  readonly #pendingCellIds = new Set<number>();
  readonly #events: WorkerOutput[] = [];
  readonly #chargedCellIds = new Set<number>();
  #chunks: ChunkStore<CoreCell>;
  #lastScheduledCommitMs = Number.NEGATIVE_INFINITY;
  #quantumVoidDebugCount = 0;

  constructor(worldSeed: number, options: SolverCoreOptions = {}) {
    if (
      !Number.isInteger(worldSeed) ||
      worldSeed < 0 ||
      worldSeed > 0xffff_ffff
    ) {
      throw new RangeError('worldSeed must be a uint32');
    }
    this.worldSeed = worldSeed >>> 0;
    this.#now = options.now ?? (() => performance.now());
    this.#workBudgetMs = options.workBudgetMs ?? MAX_SOLVER_WORK_MS;
    if (!Number.isFinite(this.#workBudgetMs) || this.#workBudgetMs <= 0) {
      throw new RangeError('workBudgetMs must be a positive finite number');
    }
    this.#chunks = this.#createChunkStore();
  }

  get diagnostics(): SolverCoreDiagnostics {
    let fixedCells = 0;
    let emptyDomains = 0;
    for (const cell of this.#cells) {
      if (cell.fixed) fixedCells += 1;
      if (isEmpty(cell.domain)) emptyDomains += 1;
    }
    return {
      pendingWork: this.#pendingWork.length,
      fixedCells,
      emptyDomains,
      quantumVoidDebugCount: this.#quantumVoidDebugCount,
    };
  }

  unlockPack(packId: UnlockablePackId): number {
    return this.#chunks.unlockPack(packId);
  }

  simulationTick(input: ObservationInput): readonly WorkerOutput[] {
    this.#events.length = 0;
    this.#chunks.activateChunksWithin(input.playerPosition);
    this.#chunks.releaseVisualsBeyond(input.playerPosition);
    this.#ensureSafeGroundWithin(input.playerPosition);
    this.#updateObservationCharge(input);

    const scheduledAtMs = input.tick * SIMULATION_TICK_MS;
    const target = this.#selectTarget(input);
    if (
      target !== null &&
      scheduledAtMs - this.#lastScheduledCommitMs >= COMMIT_COOLDOWN_MS
    ) {
      const cell = this.#cells[target.cellId];
      if (cell !== undefined && !this.#pendingCellIds.has(target.cellId)) {
        this.#pendingWork.push({
          cellId: target.cellId,
          entropyBefore: cell.entropy,
          distanceAtSchedule: distanceToCell(
            input.playerPosition,
            target.cellId,
          ),
          remainingSteps: 49,
        });
        this.#pendingCellIds.add(target.cellId);
        this.#lastScheduledCommitMs = scheduledAtMs;
      }
    }

    this.#processPendingWorkWithinBudget(input);
    return this.#events.splice(0);
  }

  #createChunkStore(): ChunkStore<CoreCell> {
    return new ChunkStore({
      createCells: (context) => {
        const cells: CoreCell[] = [];
        for (let localZ = 0; localZ < CHUNK_CELLS_PER_SIDE; localZ += 1) {
          for (let localX = 0; localX < CHUNK_CELLS_PER_SIDE; localX += 1) {
            const worldX = context.chunkX * CHUNK_CELLS_PER_SIDE + localX;
            const worldZ = context.chunkZ * CHUNK_CELLS_PER_SIDE + localZ;
            const cell = this.#cells[worldZ * WORLD_CELLS_PER_SIDE + worldX];
            if (cell === undefined) {
              throw new RangeError('chunk references a cell outside the world');
            }
            if (cell.phase === 'UNINITIALIZED') {
              cell.phase = 'SUPERPOSED';
              cell.paletteEpoch = context.paletteEpoch;
            }
            cells.push(cell);
          }
        }
        return cells;
      },
    });
  }

  #ensureSafeGroundWithin(playerPosition: WorldVector3): void {
    const minX = Math.max(
      0,
      Math.floor(
        (playerPosition[0] - SAFE_BODY_RADIUS_METERS) / CELL_SIZE_METERS,
      ),
    );
    const maxX = Math.min(
      WORLD_CELLS_PER_SIDE - 1,
      Math.floor(
        (playerPosition[0] + SAFE_BODY_RADIUS_METERS) / CELL_SIZE_METERS,
      ),
    );
    const minZ = Math.max(
      0,
      Math.floor(
        (playerPosition[2] - SAFE_BODY_RADIUS_METERS) / CELL_SIZE_METERS,
      ),
    );
    const maxZ = Math.min(
      WORLD_CELLS_PER_SIDE - 1,
      Math.floor(
        (playerPosition[2] + SAFE_BODY_RADIUS_METERS) / CELL_SIZE_METERS,
      ),
    );

    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cellId = z * WORLD_CELLS_PER_SIDE + x;
        if (distanceToCell(playerPosition, cellId) <= SAFE_BODY_RADIUS_METERS) {
          const cell = this.#cells[cellId];
          if (cell !== undefined && !cell.fixed) {
            cell.domain.lo = 1;
            cell.domain.hi = 0;
            cell.entropy = 0;
            cell.phase = 'FIXED';
            cell.fixedTerrainId = 0;
          }
        }
      }
    }
  }

  #updateObservationCharge(input: ObservationInput): void {
    const observedThisTick = new Set<number>();
    for (const visible of input.visibleCells) {
      const cell = this.#cells[visible.cellId];
      if (cell === undefined || cell.fixed || cell.phase === 'UNINITIALIZED') {
        continue;
      }
      observedThisTick.add(visible.cellId);
      const actualDistance = distanceToCell(
        input.playerPosition,
        visible.cellId,
      );
      const lineOfSight =
        visible.lineOfSight &&
        visible.distance <= MAX_OBSERVATION_DISTANCE_METERS &&
        actualDistance <= MAX_OBSERVATION_DISTANCE_METERS;
      const proximity =
        1 - smoothstep(SAFE_BODY_RADIUS_METERS, 10, actualDistance);
      const attention = lineOfSight
        ? smoothstep(0, 1, visible.alignment) * proximity
        : 0;
      cell.observationCharge = clamp01(
        cell.observationCharge +
          (attention > 0
            ? FIXED_TICK_SECONDS * attention * 1.4
            : -FIXED_TICK_SECONDS * 0.55),
      );
      if (cell.observationCharge > 0) {
        this.#chargedCellIds.add(visible.cellId);
      } else {
        this.#chargedCellIds.delete(visible.cellId);
      }
    }

    for (const cellId of [...this.#chargedCellIds]) {
      if (observedThisTick.has(cellId)) continue;
      const cell = this.#cells[cellId];
      if (cell === undefined || cell.fixed) {
        this.#chargedCellIds.delete(cellId);
        continue;
      }
      cell.observationCharge = clamp01(
        cell.observationCharge - FIXED_TICK_SECONDS * 0.55,
      );
      if (cell.observationCharge === 0) {
        this.#chargedCellIds.delete(cellId);
      }
    }
  }

  #selectTarget(input: ObservationInput): ObservationPriorityCandidate | null {
    let selected: ObservationPriorityCandidate | null = null;
    let selectedPriority = Number.NEGATIVE_INFINITY;

    for (const visible of input.visibleCells) {
      const cell = this.#cells[visible.cellId];
      if (
        cell === undefined ||
        cell.fixed ||
        cell.phase === 'UNINITIALIZED' ||
        this.#pendingCellIds.has(visible.cellId)
      ) {
        continue;
      }
      const actualDistance = distanceToCell(
        input.playerPosition,
        visible.cellId,
      );
      const normalizedEntropy = cell.entropy / MAX_BASE_ENTROPY;
      const threshold = 0.32 + 0.1 * normalizedEntropy;
      if (
        !visible.lineOfSight ||
        visible.distance > MAX_OBSERVATION_DISTANCE_METERS ||
        actualDistance > MAX_OBSERVATION_DISTANCE_METERS ||
        cell.observationCharge < threshold
      ) {
        continue;
      }

      const noise = nextFloat01(
        createRng(
          deriveSeed(
            this.worldSeed,
            `observation:${input.tick}:${visible.cellId}`,
          ),
        ),
      );
      const candidate: ObservationPriorityCandidate = {
        cellId: visible.cellId,
        observationCharge: cell.observationCharge,
        boundaryContinuity: 0,
        normalizedEntropy,
        deterministicNoise01: noise,
      };
      const priority = observationPriority(candidate);
      if (
        selected === null ||
        priority > selectedPriority ||
        (priority === selectedPriority && candidate.cellId < selected.cellId)
      ) {
        selected = candidate;
        selectedPriority = priority;
      }
    }
    return selected;
  }

  #processPendingWorkWithinBudget(input: ObservationInput): void {
    const startedAt = this.#now();
    let currentTime = startedAt;
    let committed = false;

    while (
      this.#pendingWork.length > 0 &&
      currentTime - startedAt < this.#workBudgetMs
    ) {
      const work = this.#pendingWork[0];
      if (work === undefined) break;
      work.remainingSteps -= 1;
      if (work.remainingSteps <= 0) {
        this.#pendingWork.shift();
        this.#pendingCellIds.delete(work.cellId);
        this.#completeCollapse(work, input);
        committed = true;
      }
      currentTime = this.#now();
      if (committed) break;
    }

    if (this.#pendingWork.length > 0) {
      this.#events.push({
        type: 'SOLVER_WARNING',
        tick: input.tick,
        code: 'BUDGET_EXHAUSTED',
        message: `Deferred ${this.#pendingWork.length} solver job(s) to the next tick.`,
      });
    }
  }

  #completeCollapse(work: PendingCollapseWork, input: ObservationInput): void {
    const currentDistance = distanceToCell(input.playerPosition, work.cellId);
    if (currentDistance > MAX_OBSERVATION_DISTANCE_METERS) {
      return;
    }
    const target = this.#cells[work.cellId];
    if (target === undefined || target.fixed) {
      return;
    }

    const result = attemptObservedCollapse({
      cellId: work.cellId,
      width: WORLD_CELLS_PER_SIDE,
      height: WORLD_CELLS_PER_SIDE,
      cells: this.#cells,
      definitions: BASE_WEIGHTS,
      weightContext: {
        distanceFromOrigin: distanceFromOrigin(work.cellId),
        deterministicNoise01: 0.5,
      },
      rng: createRng(
        deriveSeed(this.worldSeed, `collapse:${input.tick}:${work.cellId}`),
      ),
      propagate: () => 'STABLE',
      fallbacks: [
        {
          variantId: QUANTUM_MEADOW_VARIANT,
          kind: 'QUANTUM',
          name: 'Quantum Meadow',
        },
      ],
    });
    if (result.reveal === null) {
      return;
    }
    for (const warning of result.telemetry.warnings) {
      if (warning.code === 'QUANTUM_VOID_DEBUG') {
        this.#quantumVoidDebugCount += 1;
      }
      this.#events.push({
        type: 'SOLVER_WARNING',
        tick: input.tick,
        code: warning.code,
        message: warning.message,
      });
    }

    target.phase = 'FIXED';
    target.fixedTerrainId = result.tileId;
    target.observationCharge = 1;
    this.#chargedCellIds.delete(work.cellId);
    const collapse: CollapseEvent = {
      type: 'COLLAPSE',
      cellId: work.cellId,
      terrainTileId: result.tileId,
      featureTileId: null,
      entropyBefore: work.entropyBefore,
      durationMs: 450 + 250 * (work.entropyBefore / MAX_BASE_ENTROPY),
      worldSeed: this.worldSeed,
    };
    this.#events.push(collapse);
    this.#publishBoundaryFor(work.cellId);
  }

  #publishBoundaryFor(cellId: number): void {
    const x = cellId % WORLD_CELLS_PER_SIDE;
    const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    const chunkX = Math.floor(x / CHUNK_CELLS_PER_SIDE);
    const chunkZ = Math.floor(z / CHUNK_CELLS_PER_SIDE);
    const localX = x % CHUNK_CELLS_PER_SIDE;
    const localZ = z % CHUNK_CELLS_PER_SIDE;
    const chunkId = chunkZ * CHUNKS_PER_SIDE + chunkX;
    const directions = [] as ('N' | 'E' | 'S' | 'W')[];
    if (localZ === 0) directions.push('N');
    if (localX + 1 === CHUNK_CELLS_PER_SIDE) directions.push('E');
    if (localZ + 1 === CHUNK_CELLS_PER_SIDE) directions.push('S');
    if (localX === 0) directions.push('W');
    if (directions.length === 0) return;

    for (const direction of directions) {
      this.#chunks.updateFixedBoundary(
        chunkId,
        direction,
        this.#serializeEdge(chunkX, chunkZ, direction),
      );
    }
    const chunk = this.#chunks.getChunk(chunkId);
    if (chunk === null) return;
    const boundary = cloneBoundaryConstraint(chunk.fixedBoundary);
    const event: ChunkBoundaryEvent = {
      type: 'BOUNDARY_UPDATE',
      chunkId,
      north: boundary.north,
      east: boundary.east,
      south: boundary.south,
      west: boundary.west,
    };
    this.#events.push(event);
  }

  #serializeEdge(
    chunkX: number,
    chunkZ: number,
    direction: 'N' | 'E' | 'S' | 'W',
  ): Uint16Array {
    const edge = new Uint16Array(BOUNDARY_LENGTH);
    edge.fill(UNCONSTRAINED_TILE);
    for (let index = 0; index < CHUNK_CELLS_PER_SIDE; index += 1) {
      const localX =
        direction === 'E'
          ? CHUNK_CELLS_PER_SIDE - 1
          : direction === 'W'
            ? 0
            : index;
      const localZ =
        direction === 'S'
          ? CHUNK_CELLS_PER_SIDE - 1
          : direction === 'N'
            ? 0
            : index;
      const worldX = chunkX * CHUNK_CELLS_PER_SIDE + localX;
      const worldZ = chunkZ * CHUNK_CELLS_PER_SIDE + localZ;
      const cell = this.#cells[worldZ * WORLD_CELLS_PER_SIDE + worldX];
      if (cell?.fixedTerrainId !== null && cell?.fixedTerrainId !== undefined) {
        edge[index] = cell.fixedTerrainId;
      }
    }
    return edge;
  }
}

export interface HeadlessSimulationResult {
  readonly outputs: readonly WorkerOutput[];
  readonly emptyDomains: number;
  readonly quantumVoidDebugCount: number;
  readonly maxCommitDistance: number;
}

export function runHeadlessSimulation(
  worldSeed: number,
  tickCount = 60,
): HeadlessSimulationResult {
  const core = new SolverCore(worldSeed);
  const outputs: WorkerOutput[] = [];
  let maxCommitDistance = 0;
  const playerPosition = [64, 1.7, 64] as const;
  const targetCellIds = [2082, 2145, 2078, 2015] as const;

  for (let tick = 1; tick <= tickCount; tick += 1) {
    const targetCellId =
      targetCellIds[Math.floor((tick - 1) / 12) % targetCellIds.length]!;
    const distance = distanceToCell(playerPosition, targetCellId);
    const tickOutputs = core.simulationTick({
      type: 'OBSERVATION_TICK',
      tick,
      playerPosition,
      cameraForward: [0, 0, -1],
      visibleCells: [
        { cellId: targetCellId, distance, alignment: 1, lineOfSight: true },
      ],
    });
    outputs.push(...tickOutputs);
    for (const output of tickOutputs) {
      if (output.type === 'COLLAPSE') {
        maxCommitDistance = Math.max(
          maxCommitDistance,
          distanceToCell(playerPosition, output.cellId),
        );
      }
    }
  }
  const diagnostics = core.diagnostics;
  return {
    outputs,
    emptyDomains: diagnostics.emptyDomains,
    quantumVoidDebugCount: diagnostics.quantumVoidDebugCount,
    maxCommitDistance,
  };
}

export function solverWarning(
  tick: number | null,
  code: SolverWarning['code'],
  message: string,
): SolverWarning {
  return { type: 'SOLVER_WARNING', tick, code, message };
}

function distanceToCell(position: WorldVector3, cellId: number): number {
  if (
    !Number.isInteger(cellId) ||
    cellId < 0 ||
    cellId >= WORLD_CELLS_PER_SIDE ** 2
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const x = cellId % WORLD_CELLS_PER_SIDE;
  const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
  const centerX = (x + 0.5) * CELL_SIZE_METERS;
  const centerZ = (z + 0.5) * CELL_SIZE_METERS;
  return Math.hypot(position[0] - centerX, position[2] - centerZ);
}

function distanceFromOrigin(cellId: number): number {
  return distanceToCell([64, 0, 64], cellId);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp01((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
