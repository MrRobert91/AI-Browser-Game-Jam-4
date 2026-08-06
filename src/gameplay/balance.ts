export const STANDARD_RUN_BEATS = [
  { id: 'awakening', fromSeconds: 0, toSeconds: 40 },
  { id: 'first-terrain', fromSeconds: 40, toSeconds: 120 },
  { id: 'water', fromSeconds: 120, toSeconds: 210 },
  { id: 'forest', fromSeconds: 210, toSeconds: 300 },
  { id: 'first-danger', fromSeconds: 300, toSeconds: 390 },
  { id: 'ruin', fromSeconds: 390, toSeconds: 480 },
  { id: 'outer-zone', fromSeconds: 480, toSeconds: 560 },
  { id: 'last-look', fromSeconds: 560, toSeconds: 600 },
] as const;

export interface BalanceSession {
  readonly durationSeconds: number;
  readonly unlockSeconds: readonly number[];
  readonly fixedCells: number;
  readonly maxDistanceMeters: number;
  readonly deaths: number;
  readonly playerUnderstoodEnding: boolean;
}

export interface BalanceReport {
  readonly medianDurationSeconds: number;
  readonly normalRunsInWindow: boolean;
  readonly unlocksVisiblySpaced: boolean;
  readonly endingInterpretationRate: number;
}

export function evaluateBalanceSessions(
  sessions: readonly BalanceSession[],
): BalanceReport {
  if (sessions.length === 0)
    throw new Error('At least one session is required.');
  const durations = sessions
    .map((session) => session.durationSeconds)
    .sort((a, b) => a - b);
  const medianDurationSeconds = durations[Math.floor(durations.length / 2)]!;
  return {
    medianDurationSeconds,
    normalRunsInWindow: sessions.every(
      (session) =>
        session.durationSeconds >= 570 && session.durationSeconds <= 660,
    ),
    unlocksVisiblySpaced: sessions.every((session) =>
      session.unlockSeconds.every(
        (value, index) =>
          index === 0 || value - session.unlockSeconds[index - 1]! >= 45,
      ),
    ),
    endingInterpretationRate:
      sessions.filter((session) => session.playerUnderstoodEnding).length /
      sessions.length,
  };
}
