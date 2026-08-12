import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId, WorldVector3 } from '../contracts/world';
import { planSeedAnchors, type MacroPlan } from '../gameplay/anchors';
import {
  ProgressionSystem,
  SEED_PACK_ORDER,
  type ProgressionSnapshot,
  type SeedCollectionEvent,
} from '../gameplay/progression';
import type { NarrativeCueId } from '../gameplay/narrative';
import {
  RespawnSystem,
  type RespawnEvent,
  type RespawnSnapshot,
} from '../gameplay/respawn';

export interface Wp5VisualAdapter {
  collectSeed(
    packId: UnlockablePackId,
    silhouettes: readonly [string, string, string],
  ): void;
  setRespawnPhase(phase: RespawnSnapshot['phase']): void;
  update(deltaSeconds: number, elapsedSeconds: number): void;
}

export interface Wp5PreviewOptions {
  readonly worldSeed: number;
  readonly plan?: MacroPlan;
  readonly unlockPack: (packId: UnlockablePackId) => number;
  readonly visuals: Wp5VisualAdapter;
  readonly canonicalAutomation?: boolean;
  readonly canonicalBombAutomation?: boolean;
  readonly teleportPlayer: (position: WorldVector3) => void;
  readonly ensureRespawnGround: (position: WorldVector3) => void;
  readonly isRespawnWalkable: (position: WorldVector3) => boolean;
  readonly fractureRegion: (
    centerCellId: CellId,
    protectedCellIds: readonly CellId[],
  ) => void;
  readonly onNarrativeCue?: (cueId: NarrativeCueId) => void;
  readonly onTerminalContact?: () => void;
  readonly onLivesExhausted?: () => void;
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
  readonly bombCount: number;
  readonly respawn: RespawnSnapshot;
}

/** Production progression plus contact-only consciousness bombs and three lives. */
export class Wp5PreviewRuntime {
  readonly plan: MacroPlan;
  readonly progression: ProgressionSystem;
  readonly respawn: RespawnSystem;

  private elapsedSeconds = 0;
  private readonly bombCells = new Map<CellId, number>();
  private readonly detonatedBombs = new Set<CellId>();
  private automatedBombCount = 0;
  private readonly protectedCellIds: readonly CellId[];

  constructor(private readonly options: Wp5PreviewOptions) {
    this.plan = options.plan ?? planSeedAnchors(options.worldSeed);
    this.protectedCellIds = this.plan.anchors.flatMap((anchor) => [
      anchor.cellId,
      ...anchor.reservedCellIds,
      ...anchor.corridorCellIds,
    ]);
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

  registerConsciousnessBomb(cellId: CellId, activationDelaySeconds = 0): void {
    if (!this.detonatedBombs.has(cellId)) {
      this.bombCells.set(
        cellId,
        this.elapsedSeconds + Math.max(0, activationDelaySeconds),
      );
    }
  }

  update(frame: Wp5PreviewFrame): Wp5PreviewSnapshot {
    const delta = Math.max(0, frame.deltaSeconds);
    this.elapsedSeconds += delta;
    this.progression.update(delta);
    if (this.options.canonicalAutomation) this.runCanonicalAutomation();
    else if (this.respawn.canTakeDamage())
      this.progression.collectAt(frame.playerCellId);

    if (
      this.options.canonicalBombAutomation &&
      this.respawn.canTakeDamage() &&
      this.automatedBombCount < 3 &&
      this.elapsedSeconds >= 1 + this.automatedBombCount * 3
    ) {
      this.registerConsciousnessBomb(frame.playerCellId);
      this.automatedBombCount += 1;
    }

    if (
      this.respawn.canTakeDamage() &&
      (this.bombCells.get(frame.playerCellId) ?? Number.POSITIVE_INFINITY) <=
        this.elapsedSeconds &&
      !this.detonatedBombs.has(frame.playerCellId)
    ) {
      this.detonatedBombs.add(frame.playerCellId);
      this.bombCells.delete(frame.playerCellId);
      this.options.fractureRegion(frame.playerCellId, this.protectedCellIds);
      this.respawn.requestDeath({ cause: 'CONSCIOUSNESS_BOMB' });
      if (this.respawn.snapshot().livesRemaining === 0) {
        this.options.onTerminalContact?.();
      }
    }

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
      bombCount: this.bombCells.size,
      respawn: this.respawn.snapshot(),
    };
  }

  private handleSeedCollected(event: SeedCollectionEvent): void {
    this.options.visuals.collectSeed(event.packId, event.previewSilhouettes);
    this.options.onNarrativeCue?.(event.narrativeCueId);
  }

  private runCanonicalAutomation(): void {
    const nextIndex = this.progression.snapshot().collectedPacks.length;
    const nextPack = SEED_PACK_ORDER[nextIndex];
    if (nextPack && this.elapsedSeconds >= 2 + nextIndex * 3) {
      this.progression.collectAt(this.progression.getSeedCell(nextPack));
    }
  }

  private handleRespawnEvent(event: RespawnEvent): void {
    if (event.type === 'DEATH_STARTED') {
      this.progression.notifyDeath();
      if (event.narrativeCueId)
        this.options.onNarrativeCue?.(event.narrativeCueId);
    } else if (event.type === 'RESPAWNED') {
      this.options.onNarrativeCue?.('respawn');
    } else if (event.type === 'LIVES_EXHAUSTED') {
      this.options.onLivesExhausted?.();
    }
  }
}
