import { COMPILED_GRAMMAR } from '../contracts/grammar-runtime';
import type {
  ChunkBoundaryEvent,
  CollapseEvent,
  DomainPatchCell,
  FractureEvent,
  FractureRegionInput,
  ObservationInput,
  SolverWarning,
  WorkerOutput,
} from '../contracts/messages';
import type {
  CompiledFeatureVariant,
  CompiledTerrainVariant,
  UnlockablePackId,
} from '../contracts/tiles';
import type { CellPhase, DomainMask, WorldVector3 } from '../contracts/world';
import {
  MAX_COLLAPSE_COMMIT_DISTANCE_METERS,
  OBSERVATION_CHARGE_PER_SECOND,
  OBSERVATION_RADIUS_METERS,
} from '../contracts/observation';
import { planSeedAnchors } from '../gameplay/anchors';

import {
  assignMask,
  createEmptyMask,
  isEmpty,
  nextSetBit,
  setBit,
  singletonIndex,
  type MutableDomainMask,
} from './bitset';
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
  selectWeightedVariant,
  weightedEntropy,
  type ObservationPriorityCandidate,
  type WeightDefinition,
} from './entropy';
import { propagateCardinalConstraints, ReusableCellQueue } from './propagation';
import { createRng, deriveSeed, nextFloat01, SIMULATION_TICK_MS } from './rng';
import { attemptObservedCollapse, type TransactionCell } from './transaction';

export const FIXED_TICK_SECONDS = 0.1;
export const MAX_SOLVER_WORK_MS = 4;
export const COMMIT_COOLDOWN_MS = 90;
export const MAX_OBSERVATION_DISTANCE_METERS =
  MAX_COLLAPSE_COMMIT_DISTANCE_METERS;
export const SAFE_BODY_RADIUS_METERS = 2.5;
export const CONSCIOUSNESS_BOMB_NUMERIC_ID = 17;

const CELL_COUNT = WORLD_CELLS_PER_SIDE ** 2;
export const WATER_PACK_WEIGHT_MULTIPLIER = 1.5;
export const TREE_PACK_WEIGHT_MULTIPLIER = 1.5;
export const WATER_COMPONENT_TARGET_MAX = 24;
const MAX_TERRAIN_ENTROPY = Math.log(COMPILED_GRAMMAR.terrain.length);
const QUANTUM_MEADOW_VARIANT =
  COMPILED_GRAMMAR.terrain.find((variant) =>
    variant.id.startsWith('terrain.meadow.a@'),
  )?.variantId ?? 0;
const EMPTY_FEATURE_VARIANT =
  COMPILED_GRAMMAR.features.find((variant) => variant.id === 'feature.empty')
    ?.variantId ?? 0;
const BOMB_FEATURE_VARIANT = COMPILED_GRAMMAR.features.find(
  (variant) => variant.id === 'feature.consciousness-bomb',
)?.variantId;

export function waterCoreContinuationMultiplier(
  connectedCoreCells: number,
): number {
  if (connectedCoreCells < 8) return 2;
  if (connectedCoreCells <= 16) return 1.4;
  if (connectedCoreCells < WATER_COMPONENT_TARGET_MAX) return 0.6;
  return 0.15;
}

export function waterClosureMultiplier(connectedCoreCells: number): number {
  if (connectedCoreCells < 8) return 1;
  if (connectedCoreCells <= 16) return 1.25;
  if (connectedCoreCells < WATER_COMPONENT_TARGET_MAX) return 2.2;
  return 4;
}

class CoreCell implements TransactionCell {
  readonly cellId: number;
  readonly domain: MutableDomainMask = createEmptyMask();
  readonly featureDomain: MutableDomainMask = createEmptyMask();
  entropy = 0;
  featureEntropy = 0;
  phase: CellPhase = 'UNINITIALIZED';
  observationCharge = 0;
  paletteEpoch = 0;
  fixedTerrainVariantId: number | null = null;
  fixedTerrainId: number | null = null;
  fixedFeatureId: number | null = null;

  constructor(cellId: number) {
    this.cellId = cellId;
  }

  get fixed(): boolean {
    return this.phase === 'FIXED' || this.phase === 'FRACTURED';
  }
}

interface PendingCollapseWork {
  readonly cellId: number;
  readonly entropyBefore: number;
  readonly forcedConsequence: boolean;
  remainingSteps: number;
}

export interface SolverCoreOptions {
  readonly now?: () => number;
  readonly workBudgetMs?: number;
}

export interface SolverCoreDiagnostics {
  readonly pendingWork: number;
  readonly fixedCells: number;
  readonly fracturedCells: number;
  readonly emptyDomains: number;
  readonly quantumVoidDebugCount: number;
}

/** Deterministic, render-independent owner of the logical 64x64 WFC2 world. */
export class SolverCore {
  readonly worldSeed: number;
  readonly #now: () => number;
  readonly #workBudgetMs: number;
  readonly #cells = Array.from(
    { length: CELL_COUNT },
    (_, cellId) => new CoreCell(cellId),
  );
  readonly #pendingWork: PendingCollapseWork[] = [];
  readonly #pendingCellIds = new Set<number>();
  readonly #events: WorkerOutput[] = [];
  readonly #chargedCellIds = new Set<number>();
  readonly #propagationQueue = new ReusableCellQueue(CELL_COUNT);
  readonly #protectedCellIds: ReadonlySet<number>;
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
    const plan = planSeedAnchors(this.worldSeed);
    this.#protectedCellIds = new Set([
      2_080,
      ...plan.anchors.flatMap((anchor) => [
        anchor.cellId,
        ...anchor.reservedCellIds,
        ...anchor.corridorCellIds,
      ]),
    ]);
    this.#chunks = this.#createChunkStore();
  }

  get diagnostics(): SolverCoreDiagnostics {
    let fixedCells = 0;
    let fracturedCells = 0;
    let emptyDomains = 0;
    for (const cell of this.#cells) {
      if (cell.phase === 'FIXED') fixedCells += 1;
      if (cell.phase === 'FRACTURED') fracturedCells += 1;
      if (
        cell.phase !== 'UNINITIALIZED' &&
        cell.phase !== 'FRACTURED' &&
        (isEmpty(cell.domain) || isEmpty(cell.featureDomain))
      ) {
        emptyDomains += 1;
      }
    }
    return {
      pendingWork: this.#pendingWork.length,
      fixedCells,
      fracturedCells,
      emptyDomains,
      quantumVoidDebugCount: this.#quantumVoidDebugCount,
    };
  }

  unlockPack(packId: UnlockablePackId): number {
    return this.#chunks.unlockPack(packId);
  }

  /** Macro-plan hook used to materialize immutable reservations before observation. */
  primeFixedCell(
    cellId: number,
    terrainVariantId = QUANTUM_MEADOW_VARIANT,
    featureVariantId = EMPTY_FEATURE_VARIANT,
  ): void {
    const x = cellId % WORLD_CELLS_PER_SIDE;
    const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    this.#chunks.ensureChunk(
      Math.floor(x / CHUNK_CELLS_PER_SIDE),
      Math.floor(z / CHUNK_CELLS_PER_SIDE),
    );
    const cell = this.#cells[cellId];
    if (cell === undefined) throw new RangeError(`missing cell ${cellId}`);
    if (cell.phase === 'FIXED') return;
    if (cell.phase === 'FRACTURED') {
      throw new Error(`fractured cell ${cellId} cannot be primed`);
    }
    this.#fixCell(cell, terrainVariantId, featureVariantId);
  }

  fractureRegion(input: FractureRegionInput): FractureEvent {
    const protectedIds = new Set([
      ...this.#protectedCellIds,
      ...input.protectedCellIds,
    ]);
    const fractured: number[] = [];
    for (const cell of this.#cells) {
      if (
        cell.phase !== 'FIXED' ||
        protectedIds.has(cell.cellId) ||
        distanceBetweenCells(input.centerCellId, cell.cellId) >
          input.radiusMeters
      ) {
        continue;
      }
      cell.phase = 'FRACTURED';
      cell.fixedTerrainVariantId = null;
      cell.fixedTerrainId = null;
      cell.fixedFeatureId = null;
      cell.observationCharge = 0;
      assignMask(cell.domain, { lo: 0, hi: 0 });
      assignMask(cell.featureDomain, { lo: 0, hi: 0 });
      this.#chargedCellIds.delete(cell.cellId);
      this.#pendingCellIds.delete(cell.cellId);
      fractured.push(cell.cellId);
    }
    return {
      type: 'FRACTURE',
      tick: input.tick,
      centerCellId: input.centerCellId,
      cellIds: fractured,
    };
  }

  simulationTick(input: ObservationInput): readonly WorkerOutput[] {
    this.#events.length = 0;
    this.#chunks.activateChunksWithin(input.playerPosition);
    this.#chunks.releaseVisualsBeyond(input.playerPosition);
    this.#ensureSafeGroundWithin(input.playerPosition);
    this.#updateFeatureDomains(
      input.playerPosition,
      input.visibleCells.map((cell) => cell.cellId),
    );
    this.#updateObservationCharge(input);

    const scheduledAtMs = input.tick * SIMULATION_TICK_MS;
    const target = this.#selectTarget(input);
    if (
      target !== null &&
      scheduledAtMs - this.#lastScheduledCommitMs >= COMMIT_COOLDOWN_MS
    ) {
      this.#scheduleCollapse(target.cellId, false, 49);
      this.#lastScheduledCommitMs = scheduledAtMs;
    }

    this.#processPendingWorkWithinBudget(input);
    this.#emitDomainPatch(input);
    return this.#events.splice(0);
  }

  #createChunkStore(): ChunkStore<CoreCell> {
    return new ChunkStore({
      createCells: (context) => {
        const enabledPacks = new Set<string>([
          'base',
          ...context.unlockedPacks,
        ]);
        const terrainDomain = maskForVariants(
          COMPILED_GRAMMAR.terrain,
          (variant) => enabledPacks.has(variant.packId),
        );
        const featureDomain = maskForVariants(
          COMPILED_GRAMMAR.features,
          (variant) => enabledPacks.has(variant.packId),
        );
        const cells: CoreCell[] = [];
        for (let localZ = 0; localZ < CHUNK_CELLS_PER_SIDE; localZ += 1) {
          for (let localX = 0; localX < CHUNK_CELLS_PER_SIDE; localX += 1) {
            const worldX = context.chunkX * CHUNK_CELLS_PER_SIDE + localX;
            const worldZ = context.chunkZ * CHUNK_CELLS_PER_SIDE + localZ;
            const cell = this.#cells[worldZ * WORLD_CELLS_PER_SIDE + worldX];
            if (cell === undefined)
              throw new RangeError('chunk cell outside world');
            if (cell.phase === 'UNINITIALIZED') {
              cell.phase = 'SUPERPOSED';
              cell.paletteEpoch = context.paletteEpoch;
              assignMask(cell.domain, terrainDomain);
              assignMask(cell.featureDomain, featureDomain);
              cell.entropy = this.#terrainEntropy(cell.cellId, cell.domain);
              cell.featureEntropy = entropyForFeatures(cell.featureDomain);
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
        const cell = this.#cells[z * WORLD_CELLS_PER_SIDE + x];
        if (
          cell !== undefined &&
          cell.phase !== 'FIXED' &&
          cell.phase !== 'FRACTURED' &&
          distanceToCell(playerPosition, cell.cellId) <= SAFE_BODY_RADIUS_METERS
        ) {
          this.#fixCell(cell, QUANTUM_MEADOW_VARIANT, EMPTY_FEATURE_VARIANT);
        }
      }
    }
  }

  #updateFeatureDomains(
    playerPosition: WorldVector3,
    visibleCellIds: readonly number[],
  ): void {
    for (const cellId of visibleCellIds) {
      const cell = this.#cells[cellId];
      if (cell === undefined) continue;
      if (cell.phase === 'UNINITIALIZED' || cell.fixed) continue;
      const allowedPacks = this.#chunkPacksForCell(cell.cellId);
      const legal = createEmptyMask();
      for (const feature of COMPILED_GRAMMAR.features) {
        if (!allowedPacks.has(feature.packId)) continue;
        if (
          feature.tags.includes('origin') ||
          feature.tags.includes('seed_anchor')
        ) {
          continue;
        }
        if (!this.#featureCanUseAnyTerrain(feature, cell.domain)) continue;
        if (distanceFromOrigin(cell.cellId) < feature.minDistanceFromOrigin)
          continue;
        if (feature.blocksMovement && this.#protectedCellIds.has(cell.cellId))
          continue;
        if (
          feature.variantId === BOMB_FEATURE_VARIANT &&
          (distanceFromOrigin(cell.cellId) < 14 ||
            distanceToCell(playerPosition, cell.cellId) < 4 ||
            this.#protectedCellIds.has(cell.cellId))
        ) {
          continue;
        }
        setBit(legal, feature.variantId);
      }
      if (isEmpty(legal)) setBit(legal, EMPTY_FEATURE_VARIANT);
      assignMask(cell.featureDomain, legal);
      cell.featureEntropy = entropyForFeatures(legal);
    }
  }

  #chunkPacksForCell(cellId: number): ReadonlySet<string> {
    const x = cellId % WORLD_CELLS_PER_SIDE;
    const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    const chunkX = Math.floor(x / CHUNK_CELLS_PER_SIDE);
    const chunkZ = Math.floor(z / CHUNK_CELLS_PER_SIDE);
    const chunk = this.#chunks.getChunk(chunkZ * CHUNKS_PER_SIDE + chunkX);
    return new Set(['base', ...(chunk?.unlockedPacks ?? [])]);
  }

  #featureCanUseAnyTerrain(
    feature: CompiledFeatureVariant,
    domain: DomainMask,
  ): boolean {
    for (
      let id = nextSetBit(domain);
      id !== -1;
      id = nextSetBit(domain, id + 1)
    ) {
      const terrain = COMPILED_GRAMMAR.terrain[id];
      if (terrain?.tags.some((tag) => feature.allowedTerrainTags.includes(tag)))
        return true;
    }
    return false;
  }

  #updateObservationCharge(input: ObservationInput): void {
    const observedThisTick = new Set<number>();
    for (const visible of input.visibleCells) {
      const cell = this.#cells[visible.cellId];
      if (cell === undefined || cell.fixed || cell.phase === 'UNINITIALIZED')
        continue;
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
        1 -
        smoothstep(
          SAFE_BODY_RADIUS_METERS,
          OBSERVATION_RADIUS_METERS,
          actualDistance,
        );
      const attention = lineOfSight
        ? smoothstep(0, 1, visible.alignment) * proximity
        : 0;
      cell.observationCharge = clamp01(
        cell.observationCharge +
          (attention > 0
            ? FIXED_TICK_SECONDS * attention * OBSERVATION_CHARGE_PER_SECOND
            : -FIXED_TICK_SECONDS * 0.55),
      );
      if (cell.observationCharge > 0) this.#chargedCellIds.add(visible.cellId);
      else this.#chargedCellIds.delete(visible.cellId);
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
      if (cell.observationCharge === 0) this.#chargedCellIds.delete(cellId);
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
      )
        continue;
      const actualDistance = distanceToCell(
        input.playerPosition,
        visible.cellId,
      );
      const normalizedEntropy = clamp01(cell.entropy / MAX_TERRAIN_ENTROPY);
      if (
        !visible.lineOfSight ||
        visible.distance > MAX_OBSERVATION_DISTANCE_METERS ||
        actualDistance > MAX_OBSERVATION_DISTANCE_METERS ||
        cell.observationCharge < 0.32 + 0.1 * normalizedEntropy
      )
        continue;
      const candidate: ObservationPriorityCandidate = {
        cellId: visible.cellId,
        observationCharge: cell.observationCharge,
        boundaryContinuity: fixedNeighborRatio(this.#cells, visible.cellId),
        normalizedEntropy,
        deterministicNoise01: nextFloat01(
          createRng(
            deriveSeed(
              this.worldSeed,
              `observation:${input.tick}:${visible.cellId}`,
            ),
          ),
        ),
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

  #scheduleCollapse(
    cellId: number,
    forcedConsequence: boolean,
    remainingSteps: number,
  ): void {
    const cell = this.#cells[cellId];
    if (cell === undefined || cell.fixed || this.#pendingCellIds.has(cellId))
      return;
    this.#pendingWork.push({
      cellId,
      entropyBefore: cell.entropy,
      forcedConsequence,
      remainingSteps,
    });
    this.#pendingCellIds.add(cellId);
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
        committed = this.#completeCollapse(work, input);
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

  #completeCollapse(
    work: PendingCollapseWork,
    input: ObservationInput,
  ): boolean {
    if (
      distanceToCell(input.playerPosition, work.cellId) >
      MAX_OBSERVATION_DISTANCE_METERS
    )
      return false;
    const target = this.#cells[work.cellId];
    if (target === undefined || target.fixed) return false;
    const result = attemptObservedCollapse({
      cellId: work.cellId,
      width: WORLD_CELLS_PER_SIDE,
      height: WORLD_CELLS_PER_SIDE,
      cells: this.#cells,
      definitions: this.#terrainWeightsForCell(work.cellId),
      weightContext: this.#weightContextForCell(work.cellId),
      rng: createRng(
        deriveSeed(this.worldSeed, `collapse:${input.tick}:${work.cellId}`),
      ),
      propagate: ({ targetCellId, mutableCellIds }) =>
        propagateCardinalConstraints({
          width: WORLD_CELLS_PER_SIDE,
          height: WORLD_CELLS_PER_SIDE,
          cells: this.#cells,
          compatibility: COMPILED_GRAMMAR.terrainCompatibility,
          seedCellIds: [targetCellId],
          queue: this.#propagationQueue,
          mutableCellIds,
          recalculateEntropy: (cellId, domain) =>
            this.#terrainEntropy(cellId, domain),
        }).status,
      fallbacks: [
        {
          variantId: QUANTUM_MEADOW_VARIANT,
          kind: 'QUANTUM',
          name: 'Quantum Meadow',
        },
      ],
    });
    if (result.reveal === null) return false;
    for (const warning of result.telemetry.warnings) {
      if (warning.code === 'QUANTUM_VOID_DEBUG')
        this.#quantumVoidDebugCount += 1;
      this.#events.push({
        type: 'SOLVER_WARNING',
        tick: input.tick,
        code: warning.code,
        message: warning.message,
      });
    }
    const terrainVariant = COMPILED_GRAMMAR.terrain[result.tileId];
    if (terrainVariant === undefined)
      throw new RangeError(`missing terrain variant ${result.tileId}`);
    const featureVariantId = this.#selectFeature(target, terrainVariant, input);
    const feature = COMPILED_GRAMMAR.features[featureVariantId];
    if (feature === undefined)
      throw new RangeError(`missing feature variant ${featureVariantId}`);
    this.#fixCell(target, result.tileId, featureVariantId);
    const collapse: CollapseEvent = {
      type: 'COLLAPSE',
      cellId: work.cellId,
      terrainTileId: terrainVariant.definitionNumericId,
      featureTileId:
        feature.id === 'feature.empty' ? null : feature.definitionNumericId,
      terrainRotationQuarterTurns: terrainVariant.rotationQuarterTurns,
      entropyBefore: work.entropyBefore,
      durationMs: 225 + 125 * clamp01(work.entropyBefore / MAX_TERRAIN_ENTROPY),
      worldSeed: this.worldSeed,
    };
    this.#events.push(collapse);
    this.#publishBoundaryFor(work.cellId);
    if (!work.forcedConsequence) this.#enqueueVisibleHoles(input);
    return true;
  }

  #selectFeature(
    target: CoreCell,
    terrain: CompiledTerrainVariant,
    input: ObservationInput,
  ): number {
    const legal = createEmptyMask();
    for (
      let id = nextSetBit(target.featureDomain);
      id !== -1;
      id = nextSetBit(target.featureDomain, id + 1)
    ) {
      const feature = COMPILED_GRAMMAR.features[id];
      if (feature?.allowedTerrainTags.some((tag) => terrain.tags.includes(tag)))
        setBit(legal, id);
    }
    if (isEmpty(legal)) setBit(legal, EMPTY_FEATURE_VARIANT);
    const neighborTagCounts = this.#neighborTagCounts(target.cellId);
    const treeDensity = this.#localTreeDensity(target.cellId);
    const weights = COMPILED_GRAMMAR.features.map<WeightDefinition>(
      (feature) => {
        let weight = feature.weight;
        if (feature.tags.includes('tree')) {
          weight *= TREE_PACK_WEIGHT_MULTIPLIER;
          if ((neighborTagCounts.tree ?? 0) > 0) weight *= 2;
          if (treeDensity > 0.6) weight *= 0.35;
        } else if (
          treeDensity > 0.6 &&
          (feature.tags.includes('empty') || feature.tags.includes('mushrooms'))
        ) {
          weight *= 1.5;
        }
        return {
          weight,
          ...(feature.neighborBias === undefined
            ? {}
            : { neighborBias: feature.neighborBias }),
        };
      },
    );
    if (
      BOMB_FEATURE_VARIANT !== undefined &&
      hasVariant(legal, BOMB_FEATURE_VARIANT)
    ) {
      let otherWeight = 0;
      for (
        let id = nextSetBit(legal);
        id !== -1;
        id = nextSetBit(legal, id + 1)
      ) {
        if (id !== BOMB_FEATURE_VARIANT)
          otherWeight += weights[id]?.weight ?? 0;
      }
      const probability = consciousnessBombProbability(input.elapsedRunSeconds);
      weights[BOMB_FEATURE_VARIANT] = {
        weight: Math.max(
          Number.EPSILON,
          (probability / (1 - probability)) * otherWeight,
        ),
      };
    }
    return (
      selectWeightedVariant(
        legal,
        weights,
        {
          distanceFromOrigin: distanceFromOrigin(target.cellId),
          neighborTagCounts,
          deterministicNoise01: 0.5,
        },
        createRng(
          deriveSeed(this.worldSeed, `feature:${input.tick}:${target.cellId}`),
        ),
      ) ?? EMPTY_FEATURE_VARIANT
    );
  }

  #fixCell(
    cell: CoreCell,
    terrainVariantId: number,
    featureVariantId: number,
  ): void {
    const terrain = COMPILED_GRAMMAR.terrain[terrainVariantId];
    const feature = COMPILED_GRAMMAR.features[featureVariantId];
    if (terrain === undefined || feature === undefined)
      throw new RangeError('cannot fix unknown variants');
    cell.phase = 'FIXED';
    cell.fixedTerrainVariantId = terrainVariantId;
    cell.fixedTerrainId = terrain.definitionNumericId;
    cell.fixedFeatureId =
      feature.id === 'feature.empty' ? null : feature.definitionNumericId;
    assignMask(cell.domain, singletonMask(terrainVariantId));
    assignMask(cell.featureDomain, singletonMask(featureVariantId));
    cell.entropy = 0;
    cell.featureEntropy = 0;
    cell.observationCharge = 1;
    this.#chargedCellIds.delete(cell.cellId);
  }

  #enqueueVisibleHoles(input: ObservationInput): void {
    for (const visible of input.visibleCells) {
      const cell = this.#cells[visible.cellId];
      if (
        cell === undefined ||
        cell.fixed ||
        this.#pendingCellIds.has(visible.cellId) ||
        !visible.lineOfSight ||
        distanceToCell(input.playerPosition, visible.cellId) >
          MAX_OBSERVATION_DISTANCE_METERS
      )
        continue;
      const neighbors = cardinalNeighborIds(visible.cellId);
      if (
        neighbors.length === 4 &&
        neighbors.every((id) => this.#cells[id]?.phase === 'FIXED')
      ) {
        this.#scheduleCollapse(visible.cellId, true, 1);
      }
    }
  }

  #emitDomainPatch(input: ObservationInput): void {
    const cells: DomainPatchCell[] = [];
    for (const visible of input.visibleCells) {
      const cell = this.#cells[visible.cellId];
      if (cell === undefined || cell.phase === 'UNINITIALIZED' || cell.fixed)
        continue;
      cells.push({
        cellId: cell.cellId,
        terrain: { lo: cell.domain.lo >>> 0, hi: cell.domain.hi >>> 0 },
        feature: {
          lo: cell.featureDomain.lo >>> 0,
          hi: cell.featureDomain.hi >>> 0,
        },
        paletteEpoch: cell.paletteEpoch,
      });
    }
    if (cells.length > 0)
      this.#events.push({ type: 'DOMAIN_PATCH', tick: input.tick, cells });
  }

  #terrainEntropy(cellId: number, domain: DomainMask): number {
    return weightedEntropy(
      domain,
      this.#terrainWeightsForCell(cellId),
      this.#weightContextForCell(cellId),
    );
  }

  #weightContextForCell(cellId: number): {
    readonly distanceFromOrigin: number;
    readonly neighborTagCounts: Readonly<Record<string, number>>;
    readonly deterministicNoise01: number;
  } {
    return {
      distanceFromOrigin: distanceFromOrigin(cellId),
      neighborTagCounts: this.#neighborTagCounts(cellId),
      deterministicNoise01: 0.5,
    };
  }

  #terrainWeightsForCell(cellId: number): readonly WeightDefinition[] {
    const connectedCoreCells = this.#prospectiveLiquidComponentSize(cellId);
    const liquidNeighbors = this.#liquidNeighborPattern(cellId);
    return COMPILED_GRAMMAR.terrain.map((variant) => {
      let weight = variant.weight;
      const liquidCore =
        variant.tags.includes('deep_water') ||
        variant.tags.includes('shallow_water');
      const closure =
        variant.tags.includes('shore') || variant.tags.includes('marsh');
      if (variant.packId === 'water') weight *= WATER_PACK_WEIGHT_MULTIPLIER;
      if (liquidCore) {
        weight *= waterCoreContinuationMultiplier(connectedCoreCells);
        if (liquidNeighbors.count === 1) weight *= 1.25;
        if (liquidNeighbors.oppositePair) weight *= 1.35;
        if (liquidNeighbors.adjacentPair || liquidNeighbors.count >= 3)
          weight *= 0.65;
      } else if (closure) {
        weight *= waterClosureMultiplier(connectedCoreCells);
        if (liquidNeighbors.count > 0) weight *= 1.25;
      } else if (
        connectedCoreCells >= WATER_COMPONENT_TARGET_MAX &&
        liquidNeighbors.count > 0 &&
        variant.packId !== 'water' &&
        (variant.tags.includes('open') || variant.tags.includes('walkable'))
      ) {
        weight *= 3;
      }
      return {
        weight,
        ...(variant.distanceCurve === undefined
          ? {}
          : { distanceCurve: variant.distanceCurve }),
        ...(variant.neighborBias === undefined
          ? {}
          : { neighborBias: variant.neighborBias }),
      };
    });
  }

  #neighborTagCounts(cellId: number): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const neighborId of cardinalNeighborIds(cellId)) {
      const neighbor = this.#cells[neighborId];
      if (neighbor?.phase !== 'FIXED') continue;
      const tags = new Set<string>();
      const terrain =
        neighbor.fixedTerrainVariantId === null
          ? undefined
          : COMPILED_GRAMMAR.terrain[neighbor.fixedTerrainVariantId];
      for (const tag of terrain?.tags ?? []) tags.add(tag);
      const featureVariantId = singletonIndex(neighbor.featureDomain);
      const feature =
        featureVariantId === null
          ? undefined
          : COMPILED_GRAMMAR.features[featureVariantId];
      for (const tag of feature?.tags ?? []) tags.add(tag);
      for (const tag of tags) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    return counts;
  }

  #prospectiveLiquidComponentSize(cellId: number): number {
    const queue = cardinalNeighborIds(cellId).filter((neighborId) =>
      this.#isFixedLiquidCore(neighborId),
    );
    const visited = new Set<number>();
    while (queue.length > 0 && visited.size < WATER_COMPONENT_TARGET_MAX) {
      const current = queue.shift();
      if (current === undefined || visited.has(current)) continue;
      if (!this.#isFixedLiquidCore(current)) continue;
      visited.add(current);
      for (const neighborId of cardinalNeighborIds(current)) {
        if (!visited.has(neighborId) && this.#isFixedLiquidCore(neighborId))
          queue.push(neighborId);
      }
    }
    return Math.min(WATER_COMPONENT_TARGET_MAX, visited.size + 1);
  }

  #isFixedLiquidCore(cellId: number): boolean {
    const cell = this.#cells[cellId];
    if (cell?.phase !== 'FIXED' || cell.fixedTerrainVariantId === null)
      return false;
    const terrain = COMPILED_GRAMMAR.terrain[cell.fixedTerrainVariantId];
    return (
      terrain?.tags.includes('deep_water') === true ||
      terrain?.tags.includes('shallow_water') === true
    );
  }

  #liquidNeighborPattern(cellId: number): {
    readonly count: number;
    readonly oppositePair: boolean;
    readonly adjacentPair: boolean;
  } {
    const x = cellId % WORLD_CELLS_PER_SIDE;
    const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    const north =
      z > 0 && this.#isFixedLiquidCore(cellId - WORLD_CELLS_PER_SIDE);
    const east =
      x + 1 < WORLD_CELLS_PER_SIDE && this.#isFixedLiquidCore(cellId + 1);
    const south =
      z + 1 < WORLD_CELLS_PER_SIDE &&
      this.#isFixedLiquidCore(cellId + WORLD_CELLS_PER_SIDE);
    const west = x > 0 && this.#isFixedLiquidCore(cellId - 1);
    const count = [north, east, south, west].filter(Boolean).length;
    return {
      count,
      oppositePair: count === 2 && ((north && south) || (east && west)),
      adjacentPair:
        count === 2 &&
        ((north && east) ||
          (east && south) ||
          (south && west) ||
          (west && north)),
    };
  }

  #localTreeDensity(cellId: number): number {
    const centerX = cellId % WORLD_CELLS_PER_SIDE;
    const centerZ = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    let fixedForestCells = 0;
    let trees = 0;
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        const x = centerX + dx;
        const z = centerZ + dz;
        if (
          x < 0 ||
          z < 0 ||
          x >= WORLD_CELLS_PER_SIDE ||
          z >= WORLD_CELLS_PER_SIDE
        )
          continue;
        const cell = this.#cells[z * WORLD_CELLS_PER_SIDE + x];
        if (cell?.phase !== 'FIXED' || cell.fixedTerrainVariantId === null)
          continue;
        const terrain = COMPILED_GRAMMAR.terrain[cell.fixedTerrainVariantId];
        if (!terrain?.tags.includes('forest')) continue;
        fixedForestCells += 1;
        const featureVariantId = singletonIndex(cell.featureDomain);
        if (
          featureVariantId !== null &&
          COMPILED_GRAMMAR.features[featureVariantId]?.tags.includes('tree')
        )
          trees += 1;
      }
    }
    return fixedForestCells === 0 ? 0 : trees / fixedForestCells;
  }

  #publishBoundaryFor(cellId: number): void {
    const x = cellId % WORLD_CELLS_PER_SIDE;
    const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
    const chunkX = Math.floor(x / CHUNK_CELLS_PER_SIDE);
    const chunkZ = Math.floor(z / CHUNK_CELLS_PER_SIDE);
    const localX = x % CHUNK_CELLS_PER_SIDE;
    const localZ = z % CHUNK_CELLS_PER_SIDE;
    const chunkId = chunkZ * CHUNKS_PER_SIDE + chunkX;
    const directions: ('N' | 'E' | 'S' | 'W')[] = [];
    if (localZ === 0) directions.push('N');
    if (localX + 1 === CHUNK_CELLS_PER_SIDE) directions.push('E');
    if (localZ + 1 === CHUNK_CELLS_PER_SIDE) directions.push('S');
    if (localX === 0) directions.push('W');
    for (const direction of directions) {
      this.#chunks.updateFixedBoundary(
        chunkId,
        direction,
        this.#serializeEdge(chunkX, chunkZ, direction),
      );
    }
    if (directions.length === 0) return;
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
      const cell =
        this.#cells[
          (chunkZ * CHUNK_CELLS_PER_SIDE + localZ) * WORLD_CELLS_PER_SIDE +
            chunkX * CHUNK_CELLS_PER_SIDE +
            localX
        ];
      if (cell?.fixedTerrainId !== null && cell?.fixedTerrainId !== undefined)
        edge[index] = cell.fixedTerrainId;
    }
    return edge;
  }
}

export function consciousnessBombProbability(
  elapsedRunSeconds: number,
): number {
  const minute = Math.min(9, Math.max(0, Math.floor(elapsedRunSeconds / 60)));
  return (minute + 1) / 100;
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
      elapsedRunSeconds: tick * FIXED_TICK_SECONDS,
      visibleCells: [
        { cellId: targetCellId, distance, alignment: 1, lineOfSight: true },
      ],
    });
    outputs.push(...tickOutputs);
    for (const output of tickOutputs)
      if (output.type === 'COLLAPSE')
        maxCommitDistance = Math.max(
          maxCommitDistance,
          distanceToCell(playerPosition, output.cellId),
        );
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

function maskForVariants<T extends { readonly variantId: number }>(
  variants: readonly T[],
  predicate: (variant: T) => boolean,
): MutableDomainMask {
  const mask = createEmptyMask();
  for (const variant of variants)
    if (predicate(variant)) setBit(mask, variant.variantId);
  return mask;
}

function singletonMask(variantId: number): MutableDomainMask {
  const mask = createEmptyMask();
  setBit(mask, variantId);
  return mask;
}

function hasVariant(mask: DomainMask, variantId: number): boolean {
  return (
    singletonIndex({
      lo: variantId < 32 ? (mask.lo & (1 << variantId)) >>> 0 : 0,
      hi: variantId >= 32 ? (mask.hi & (1 << (variantId - 32))) >>> 0 : 0,
    }) !== null
  );
}

function entropyForFeatures(domain: DomainMask): number {
  const definitions = COMPILED_GRAMMAR.features.map<WeightDefinition>(
    (variant) => ({ weight: variant.weight }),
  );
  return weightedEntropy(domain, definitions, {
    distanceFromOrigin: 0,
    deterministicNoise01: 0.5,
  });
}

function cardinalNeighborIds(cellId: number): readonly number[] {
  const x = cellId % WORLD_CELLS_PER_SIDE;
  const z = Math.floor(cellId / WORLD_CELLS_PER_SIDE);
  const ids: number[] = [];
  if (z > 0) ids.push(cellId - WORLD_CELLS_PER_SIDE);
  if (x + 1 < WORLD_CELLS_PER_SIDE) ids.push(cellId + 1);
  if (z + 1 < WORLD_CELLS_PER_SIDE) ids.push(cellId + WORLD_CELLS_PER_SIDE);
  if (x > 0) ids.push(cellId - 1);
  return ids;
}

function fixedNeighborRatio(
  cells: readonly CoreCell[],
  cellId: number,
): number {
  const neighbors = cardinalNeighborIds(cellId);
  return neighbors.length === 0
    ? 0
    : neighbors.filter((id) => cells[id]?.phase === 'FIXED').length /
        neighbors.length;
}

function distanceBetweenCells(left: number, right: number): number {
  const leftX = ((left % WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
  const leftZ =
    (Math.floor(left / WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
  const rightX = ((right % WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
  const rightZ =
    (Math.floor(right / WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
  return Math.hypot(leftX - rightX, leftZ - rightZ);
}

function distanceToCell(position: WorldVector3, cellId: number): number {
  if (!Number.isInteger(cellId) || cellId < 0 || cellId >= CELL_COUNT)
    return Number.POSITIVE_INFINITY;
  const centerX = ((cellId % WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
  const centerZ =
    (Math.floor(cellId / WORLD_CELLS_PER_SIDE) + 0.5) * CELL_SIZE_METERS;
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
