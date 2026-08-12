import type { GamePhase } from '../contracts/localization';

export const BRIEFING_DURATION_SECONDS = 50;
export const BRIEFING_SKIP_DELAY_SECONDS = 3;

export interface PrologueSnapshot {
  readonly phase: GamePhase;
  readonly briefingElapsedSeconds: number;
  readonly canSkip: boolean;
  readonly canReplay: boolean;
  readonly portalOpen: boolean;
}

export class PrologueDirector {
  private phase: GamePhase = 'LANGUAGE_SELECT';
  private briefingElapsedSeconds = 0;
  private hasCompletedBriefing = false;
  private hasCompletedObjectives = false;

  enterRoom(): PrologueSnapshot {
    if (this.phase === 'LANGUAGE_SELECT') this.phase = 'ROOM';
    return this.snapshot();
  }

  pressButton(inRangeAndFocused: boolean): PrologueSnapshot {
    if (
      inRangeAndFocused &&
      (this.phase === 'ROOM' || this.phase === 'PORTAL')
    ) {
      this.phase = 'BRIEFING';
      this.briefingElapsedSeconds = 0;
    }
    return this.snapshot();
  }

  update(deltaSeconds: number): PrologueSnapshot {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Prologue delta must be finite and non-negative.');
    }
    if (this.phase !== 'BRIEFING') return this.snapshot();
    this.briefingElapsedSeconds = Math.min(
      BRIEFING_DURATION_SECONDS,
      this.briefingElapsedSeconds + deltaSeconds,
    );
    if (this.briefingElapsedSeconds >= BRIEFING_DURATION_SECONDS) {
      this.completeBriefing();
    }
    return this.snapshot();
  }

  skip(): PrologueSnapshot {
    if (
      this.phase === 'BRIEFING' &&
      this.briefingElapsedSeconds >= BRIEFING_SKIP_DELAY_SECONDS
    ) {
      this.completeBriefing();
    }
    return this.snapshot();
  }

  completeBriefing(): PrologueSnapshot {
    if (this.phase === 'BRIEFING') {
      this.hasCompletedBriefing = true;
      this.phase = 'OBJECTIVES';
      this.briefingElapsedSeconds = BRIEFING_DURATION_SECONDS;
    }
    return this.snapshot();
  }

  completeObjectives(): PrologueSnapshot {
    if (this.phase === 'OBJECTIVES') {
      this.hasCompletedObjectives = true;
      this.phase = 'PORTAL';
    }
    return this.snapshot();
  }

  crossPortal(): PrologueSnapshot {
    if (this.phase === 'PORTAL') this.phase = 'RUN';
    return this.snapshot();
  }

  startEnding(): PrologueSnapshot {
    if (this.phase === 'RUN') this.phase = 'ENDING';
    return this.snapshot();
  }

  snapshot(): PrologueSnapshot {
    return {
      phase: this.phase,
      briefingElapsedSeconds: this.briefingElapsedSeconds,
      canSkip:
        this.phase === 'BRIEFING' &&
        this.briefingElapsedSeconds >= BRIEFING_SKIP_DELAY_SECONDS,
      canReplay:
        this.phase === 'PORTAL' &&
        this.hasCompletedBriefing &&
        this.hasCompletedObjectives,
      portalOpen: this.phase === 'PORTAL' || this.phase === 'RUN',
    };
  }
}
