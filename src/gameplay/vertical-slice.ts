export const VERTICAL_SLICE_DURATION_SECONDS = 90;
export const WATER_UNLOCK_AT_SECONDS = 30;
export const CANONICAL_DEATH_AT_SECONDS = 54;

export type VerticalSlicePhase =
  'READY' | 'OBSERVING' | 'RESPAWNING' | 'ENDING' | 'COMPLETE';

export interface VerticalSliceSnapshot {
  readonly phase: VerticalSlicePhase;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly waterUnlocked: boolean;
  readonly deaths: number;
  readonly endingProgress: number;
}

export interface VerticalSliceEvents {
  readonly onWaterUnlock?: () => void;
  readonly onDeath?: () => void;
  readonly onRespawn?: () => void;
  readonly onEnding?: () => void;
  readonly onComplete?: () => void;
}

export interface VerticalSliceOptions {
  readonly durationSeconds?: number;
  readonly canonicalReplay?: boolean;
  readonly endingDurationSeconds?: number;
  readonly startAtSeconds?: number;
}

/** Deterministic gate state machine. Its clock starts on the first collapse. */
export class VerticalSliceDirector {
  private readonly durationSeconds: number;
  private readonly endingDurationSeconds: number;
  private readonly canonicalReplay: boolean;
  private phase: VerticalSlicePhase = 'READY';
  private elapsedSeconds = 0;
  private endingElapsedSeconds = 0;
  private respawnElapsedSeconds = 0;
  private waterUnlocked = false;
  private deaths = 0;
  private canonicalDeathTriggered = false;

  constructor(
    private readonly events: VerticalSliceEvents = {},
    options: VerticalSliceOptions = {},
  ) {
    this.durationSeconds =
      options.durationSeconds ?? VERTICAL_SLICE_DURATION_SECONDS;
    this.endingDurationSeconds = options.endingDurationSeconds ?? 8;
    this.canonicalReplay = options.canonicalReplay ?? false;
    this.elapsedSeconds = Math.min(
      this.durationSeconds,
      Math.max(0, options.startAtSeconds ?? 0),
    );
  }

  notifyFirstCollapse(): void {
    if (this.phase === 'READY') {
      this.phase = 'OBSERVING';
    }
  }

  update(deltaSeconds: number): VerticalSliceSnapshot {
    const delta = Math.max(0, deltaSeconds);
    const phaseAtStart = this.phase;
    if (this.phase === 'OBSERVING' || this.phase === 'RESPAWNING') {
      this.elapsedSeconds = Math.min(
        this.durationSeconds,
        this.elapsedSeconds + delta,
      );

      if (
        !this.waterUnlocked &&
        this.elapsedSeconds >= WATER_UNLOCK_AT_SECONDS
      ) {
        this.waterUnlocked = true;
        this.events.onWaterUnlock?.();
      }
      if (
        this.canonicalReplay &&
        !this.canonicalDeathTriggered &&
        this.elapsedSeconds >= CANONICAL_DEATH_AT_SECONDS
      ) {
        this.canonicalDeathTriggered = true;
        this.triggerDeath();
      }
      if (this.elapsedSeconds >= this.durationSeconds) {
        this.phase = 'ENDING';
        this.events.onEnding?.();
      }
    }

    if (this.phase === 'RESPAWNING' && phaseAtStart === 'RESPAWNING') {
      this.respawnElapsedSeconds += delta;
      if (this.respawnElapsedSeconds >= 0.82) {
        this.phase = 'OBSERVING';
        this.respawnElapsedSeconds = 0;
        this.events.onRespawn?.();
      }
    } else if (this.phase === 'ENDING' && phaseAtStart === 'ENDING') {
      this.endingElapsedSeconds += delta;
      if (this.endingElapsedSeconds >= this.endingDurationSeconds) {
        this.phase = 'COMPLETE';
        this.events.onComplete?.();
      }
    }

    return this.snapshot();
  }

  triggerDeath(): boolean {
    if (this.phase !== 'OBSERVING') {
      return false;
    }
    this.phase = 'RESPAWNING';
    this.respawnElapsedSeconds = 0;
    this.deaths += 1;
    this.events.onDeath?.();
    return true;
  }

  snapshot(): VerticalSliceSnapshot {
    return {
      phase: this.phase,
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds: Math.max(0, this.durationSeconds - this.elapsedSeconds),
      waterUnlocked: this.waterUnlocked,
      deaths: this.deaths,
      endingProgress: Math.min(
        1,
        this.endingElapsedSeconds / this.endingDurationSeconds,
      ),
    };
  }
}
