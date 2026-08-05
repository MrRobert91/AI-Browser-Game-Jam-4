import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId, WorldVector3 } from '../contracts/world';
import { planSeedAnchors, type MacroPlan } from '../gameplay/anchors';
import {
  HazardSystem,
  type HazardInstance,
  type HazardPlacementCandidate,
  type HazardType,
} from '../gameplay/hazards';
import {
  ProgressionSystem,
  SEED_PACK_ORDER,
  type ProgressionSnapshot,
  type SeedCollectionEvent,
} from '../gameplay/progression';
import {
  RespawnSystem,
  type RespawnEvent,
  type RespawnSnapshot,
} from '../gameplay/respawn';
import {
  UncertaintySystem,
  type UncertaintySnapshot,
} from '../gameplay/uncertainty-enemy';

export interface Wp5VisualAdapter {
  collectSeed(
    packId: UnlockablePackId,
    silhouettes: readonly [string, string, string],
  ): void;
  addHazard(hazard: HazardInstance): void;
  updateUncertainty(snapshot: UncertaintySnapshot): void;
  setRespawnPhase(phase: RespawnSnapshot['phase']): void;
  update(deltaSeconds: number, elapsedSeconds: number): void;
}

export interface Wp5PreviewOptions {
  readonly worldSeed: number;
  readonly plan?: MacroPlan;
  readonly unlockPack: (packId: UnlockablePackId) => number;
  readonly visuals: Wp5VisualAdapter;
  readonly canonicalAutomation?: boolean;
  readonly reducedFlashes?: boolean;
  readonly teleportPlayer: (position: WorldVector3) => void;
  readonly ensureRespawnGround: (position: WorldVector3) => void;
  readonly isRespawnWalkable: (position: WorldVector3) => boolean;
  readonly onMessage?: (message: string) => void;
  readonly onClockReward?: (seconds: number) => void;
}

export interface Wp5PreviewFrame {
  readonly deltaSeconds: number;
  readonly playerPosition: WorldVector3;
  readonly cameraForward: WorldVector3;
  readonly playerCellId: CellId;
  readonly fixedCells: number;
}

export interface Wp5PreviewSnapshot {
  readonly elapsedSeconds: number;
  readonly plan: MacroPlan;
  readonly progression: ProgressionSnapshot;
  readonly hazardCount: number;
  readonly uncertainty: UncertaintySnapshot | null;
  readonly respawn: RespawnSnapshot;
}

function distanceFromOrigin(cellId: CellId): number {
  const x = cellId % 64;
  const z = Math.floor(cellId / 64);
  return Math.hypot((x - 32) * 2, (z - 32) * 2);
}

function distanceToPlayer(cellId: CellId, player: WorldVector3): number {
  const x = ((cellId % 64) + 0.5) * 2;
  const z = (Math.floor(cellId / 64) + 0.5) * 2;
  return Math.hypot(x - player[0], z - player[2]);
}

function cellDirection(
  from: WorldVector3,
  cellId: CellId,
): readonly [number, number, number] {
  const x = ((cellId % 64) + 0.5) * 2 - from[0];
  const y = -from[1];
  const z = (Math.floor(cellId / 64) + 0.5) * 2 - from[2];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function dot(
  left: WorldVector3,
  right: readonly [number, number, number],
): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cardinalNeighbors(cellId: CellId): readonly CellId[] {
  const x = cellId % 64;
  const z = Math.floor(cellId / 64);
  return [
    z > 0 ? cellId - 64 : null,
    x < 63 ? cellId + 1 : null,
    z < 63 ? cellId + 64 : null,
    x > 0 ? cellId - 1 : null,
  ].filter((value): value is number => value !== null);
}

export class Wp5PreviewRuntime {
  readonly plan: MacroPlan;
  readonly progression: ProgressionSystem;
  readonly hazards: HazardSystem;
  readonly uncertainty = new UncertaintySystem();
  readonly respawn: RespawnSystem;

  private elapsedSeconds = 0;
  private readonly hazardCells = new Set<CellId>();
  private enemyId: number | null = null;
  private forcedPreviewDeath = false;

  constructor(private readonly options: Wp5PreviewOptions) {
    this.plan = options.plan ?? planSeedAnchors(options.worldSeed);
    this.hazards = new HazardSystem(options.reducedFlashes ?? true);
    this.progression = new ProgressionSystem(this.plan, {
      unlockPack: options.unlockPack,
      onSeedCollected: (event) => this.handleSeedCollected(event),
    });
    this.respawn = new RespawnSystem({
      teleportPlayer: options.teleportPlayer,
      ensureRespawnGround: options.ensureRespawnGround,
      isRespawnWalkable: options.isRespawnWalkable,
      onEvent: (event) => this.handleRespawnEvent(event),
    });
  }

  update(frame: Wp5PreviewFrame): Wp5PreviewSnapshot {
    const delta = Math.max(0, frame.deltaSeconds);
    this.elapsedSeconds += delta;
    this.progression.update(delta);

    if (this.options.canonicalAutomation) {
      this.runCanonicalAutomation();
    } else if (this.respawn.canTakeDamage()) {
      this.progression.collectAt(frame.playerCellId);
    }

    const occupied = new Set<CellId>([frame.playerCellId]);
    for (const event of this.hazards.update(delta, occupied)) {
      if (event.type === 'LETHAL_CONTACT') {
        this.respawn.requestDeath({ cause: 'HAZARD' });
      }
    }

    this.ensureUncertainty(frame);
    this.updateUncertainty(frame);
    this.respawn.update(delta);
    this.options.visuals.setRespawnPhase(this.respawn.snapshot().phase);
    this.options.visuals.update(delta, this.elapsedSeconds);
    return this.snapshot();
  }

  snapshot(): Wp5PreviewSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      plan: this.plan,
      progression: this.progression.snapshot(),
      hazardCount: this.hazardCells.size,
      uncertainty:
        this.enemyId === null ? null : this.uncertainty.get(this.enemyId),
      respawn: this.respawn.snapshot(),
    };
  }

  private handleSeedCollected(event: SeedCollectionEvent): void {
    this.options.visuals.collectSeed(event.packId, event.previewSilhouettes);
    this.options.onMessage?.(event.narrativeLine);
    this.placeHazardsFor(event.packId);
  }

  private placeHazardsFor(packId: UnlockablePackId): void {
    const requests: readonly HazardType[] =
      packId === 'water'
        ? ['DEEP_WATER']
        : packId === 'storm'
          ? ['SPIKES', 'CHARGED_CRYSTAL', 'FRAGILE_GROUND']
          : [];
    if (requests.length === 0) return;
    const basePack = packId === 'water' ? 'forest' : 'storm';
    const base = this.plan.anchors.find(
      (anchor) => anchor.packId === basePack,
    )!;
    const protectedCells = new Set(
      this.plan.anchors.flatMap((anchor) => [
        ...anchor.reservedCellIds,
        ...anchor.corridorCellIds,
      ]),
    );

    requests.forEach((type, index) => {
      const cellId = this.findUnprotectedCell(
        base.cellId,
        index + 2,
        protectedCells,
      );
      const unlockedPacks = new Set(this.progression.snapshot().collectedPacks);
      const candidate: HazardPlacementCandidate = {
        cellId,
        type,
        distanceFromOriginMeters: distanceFromOrigin(cellId),
        distanceFromPlayerMeters: 12,
        onReservedAnchor: false,
        onSafeCorridor: false,
        hasSafeWaterExit: true,
        unlockedPacks,
      };
      const hazard = this.hazards.place(candidate, 0);
      if (!hazard) return;
      this.hazards.setCollapseProgress(cellId, 1);
      this.hazardCells.add(cellId);
      this.options.visuals.addHazard(hazard);
    });
  }

  private findUnprotectedCell(
    baseCellId: CellId,
    salt: number,
    protectedCells: ReadonlySet<CellId>,
  ): CellId {
    const baseX = baseCellId % 64;
    const baseZ = Math.floor(baseCellId / 64);
    for (let radius = 2; radius <= 8; radius += 1) {
      const candidates = [
        { x: baseX + radius, z: baseZ + salt },
        { x: baseX - radius, z: baseZ - salt },
        { x: baseX + salt, z: baseZ - radius },
        { x: baseX - salt, z: baseZ + radius },
      ];
      for (const candidate of candidates) {
        if (
          candidate.x < 0 ||
          candidate.z < 0 ||
          candidate.x >= 64 ||
          candidate.z >= 64
        ) {
          continue;
        }
        const cellId = candidate.z * 64 + candidate.x;
        if (!protectedCells.has(cellId) && !this.hazardCells.has(cellId)) {
          return cellId;
        }
      }
    }
    throw new Error('Could not find an unprotected hazard cell.');
  }

  private ensureUncertainty(frame: Wp5PreviewFrame): void {
    if (!this.progression.hasCollected('storm') || this.enemyId !== null)
      return;
    const storm = this.plan.anchors.find(
      (anchor) => anchor.packId === 'storm',
    )!;
    const candidateCell = this.findUnprotectedCell(
      storm.cellId,
      6,
      new Set(this.plan.anchors.flatMap((anchor) => anchor.reservedCellIds)),
    );
    const snapshot = this.uncertainty.spawn({
      id: 1,
      cellId: candidateCell,
      distanceFromOriginMeters: distanceFromOrigin(candidateCell),
      distanceFromPlayerMeters: distanceToPlayer(
        candidateCell,
        frame.playerPosition,
      ),
      fixedCells: frame.fixedCells,
      stormGuardian: true,
    });
    if (snapshot) {
      this.enemyId = snapshot.id;
      this.options.visuals.updateUncertainty(snapshot);
    }
  }

  private updateUncertainty(frame: Wp5PreviewFrame): void {
    if (this.enemyId === null) return;
    const enemy = this.uncertainty.get(this.enemyId);
    if (!enemy || enemy.state === 'FIXED_STATUE') return;
    const direction = cellDirection(frame.playerPosition, enemy.cellId);
    const observed = this.options.canonicalAutomation
      ? this.elapsedSeconds >= 16
      : dot(frame.cameraForward, direction) >= Math.cos(Math.PI / 6);
    const events = this.uncertainty.update(this.enemyId, {
      deltaSeconds: frame.deltaSeconds,
      observedInCentralCone: observed,
      playerContact: frame.playerCellId === enemy.cellId,
      neighbors: cardinalNeighbors(enemy.cellId).map((cellId) => ({
        cellId,
        walkable: true,
        visible: observed,
      })),
    });
    for (const event of events) {
      if (event.type === 'PLAYER_DEATH') {
        this.respawn.requestDeath({ cause: 'UNCERTAINTY' });
      } else if (event.type === 'FIXED_STATUE') {
        this.options.onClockReward?.(event.rewardSeconds);
        this.options.onMessage?.('La incertidumbre conserva ahora una forma.');
      }
    }
    const next = this.uncertainty.get(this.enemyId);
    if (next) this.options.visuals.updateUncertainty(next);
  }

  private runCanonicalAutomation(): void {
    const nextIndex = this.progression.snapshot().collectedPacks.length;
    const threshold = 2 + nextIndex * 3;
    const nextPack = SEED_PACK_ORDER[nextIndex];
    if (nextPack && this.elapsedSeconds >= threshold) {
      this.progression.collectAt(this.progression.getSeedCell(nextPack));
    }
    if (!this.forcedPreviewDeath && this.elapsedSeconds >= 14) {
      this.forcedPreviewDeath = true;
      this.respawn.requestDeath({ cause: 'HAZARD' });
    }
  }

  private handleRespawnEvent(event: RespawnEvent): void {
    if (event.type === 'DEATH_STARTED') {
      this.progression.notifyDeath();
      if (event.narrativeLine) this.options.onMessage?.(event.narrativeLine);
    }
    if (event.type === 'RESPAWNED') {
      this.options.onMessage?.('El mundo y las Semillas permanecen.');
    }
  }
}
