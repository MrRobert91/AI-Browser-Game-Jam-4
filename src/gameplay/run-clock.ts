export type RunMode = 'brief' | 'standard' | 'contemplative';

export const RUN_DURATION_SECONDS: Readonly<Record<RunMode, number>> = {
  brief: 5 * 60,
  standard: 10 * 60,
  contemplative: 15 * 60,
};

export type RunClockPhase = 'READY' | 'RUNNING' | 'ENDING' | 'COMPLETE';
export type RunPauseReason = 'MENU' | 'HIDDEN' | 'SEED';

export interface RunClockSnapshot {
  readonly mode: RunMode;
  readonly phase: RunClockPhase;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly paused: boolean;
  readonly pauseReasons: readonly RunPauseReason[];
  readonly canCommit: boolean;
}

export interface RunClockEvents {
  readonly onCountdown?: (remainingSeconds: 60 | 30) => void;
  readonly onEnding?: () => void;
}

export interface RunClockOptions {
  readonly mode?: RunMode;
  readonly durationSeconds?: number;
  readonly startAtSeconds?: number;
}

/** Deterministic run clock. Calibration, loading and instructions never start it. */
export class RunClock {
  private readonly mode: RunMode;
  private readonly durationSeconds: number;
  private readonly pauseReasons = new Set<RunPauseReason>();
  private readonly announcedCountdowns = new Set<60 | 30>();
  private phase: RunClockPhase = 'READY';
  private elapsedSeconds: number;

  constructor(
    private readonly events: RunClockEvents = {},
    options: RunClockOptions = {},
  ) {
    this.mode = options.mode ?? 'standard';
    this.durationSeconds =
      options.durationSeconds ?? RUN_DURATION_SECONDS[this.mode];
    if (!Number.isFinite(this.durationSeconds) || this.durationSeconds <= 0) {
      throw new RangeError('durationSeconds must be a positive finite number');
    }
    this.elapsedSeconds = Math.min(
      this.durationSeconds,
      Math.max(0, options.startAtSeconds ?? 0),
    );
  }

  notifyFirstCollapse(): RunClockSnapshot {
    if (this.phase === 'READY') this.phase = 'RUNNING';
    return this.snapshot();
  }

  setPaused(reason: RunPauseReason, paused: boolean): RunClockSnapshot {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    return this.snapshot();
  }

  /** Death intentionally has no pause reason: its cost is run time. */
  update(deltaSeconds: number): RunClockSnapshot {
    if (
      this.phase !== 'RUNNING' ||
      this.pauseReasons.size > 0 ||
      !Number.isFinite(deltaSeconds) ||
      deltaSeconds <= 0
    ) {
      return this.snapshot();
    }

    const before = this.remainingSeconds();
    this.elapsedSeconds = Math.min(
      this.durationSeconds,
      this.elapsedSeconds + deltaSeconds,
    );
    const after = this.remainingSeconds();
    for (const threshold of [60, 30] as const) {
      if (
        before > threshold &&
        after <= threshold &&
        !this.announcedCountdowns.has(threshold)
      ) {
        this.announcedCountdowns.add(threshold);
        this.events.onCountdown?.(threshold);
      }
    }

    if (this.elapsedSeconds >= this.durationSeconds) {
      this.phase = 'ENDING';
      this.pauseReasons.clear();
      this.events.onEnding?.();
    }
    return this.snapshot();
  }

  addTime(seconds: number): RunClockSnapshot {
    if (
      this.phase === 'RUNNING' &&
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      this.elapsedSeconds = Math.max(0, this.elapsedSeconds - seconds);
    }
    return this.snapshot();
  }

  markComplete(): RunClockSnapshot {
    if (this.phase === 'ENDING') this.phase = 'COMPLETE';
    return this.snapshot();
  }

  canCommit(): boolean {
    return this.phase === 'READY' || this.phase === 'RUNNING';
  }

  snapshot(): RunClockSnapshot {
    const reasons = [...this.pauseReasons].sort();
    return {
      mode: this.mode,
      phase: this.phase,
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds: this.remainingSeconds(),
      paused: reasons.length > 0,
      pauseReasons: reasons,
      canCommit: this.canCommit(),
    };
  }

  private remainingSeconds(): number {
    return Math.max(0, this.durationSeconds - this.elapsedSeconds);
  }
}
