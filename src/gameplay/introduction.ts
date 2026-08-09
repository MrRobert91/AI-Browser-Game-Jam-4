import introduction from '../content/introduction.json';

export interface IntroductionBeat {
  readonly id: string;
  readonly eyebrow: string;
  readonly text: string;
}

export const INTRODUCTION_BEAT_MS = 8_000;
export const INTRODUCTION_MAX_MS = INTRODUCTION_BEAT_MS * introduction.length;

export const INTRODUCTION_BEATS: readonly IntroductionBeat[] = introduction;

export class AgencyIntroduction {
  private index = 0;
  private elapsedMs = 0;
  private skipped = false;

  get current(): IntroductionBeat {
    return INTRODUCTION_BEATS[this.index] ?? INTRODUCTION_BEATS[0]!;
  }

  get complete(): boolean {
    return this.index === INTRODUCTION_BEATS.length - 1;
  }

  get wasSkipped(): boolean {
    return this.skipped;
  }

  advance(deltaMs: number): IntroductionBeat {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError(
        'Introduction delta must be a finite positive duration.',
      );
    }
    if (this.complete) return this.current;
    this.elapsedMs += deltaMs;
    while (this.elapsedMs >= INTRODUCTION_BEAT_MS && !this.complete) {
      this.elapsedMs -= INTRODUCTION_BEAT_MS;
      this.index += 1;
    }
    return this.current;
  }

  skip(): IntroductionBeat {
    this.index = INTRODUCTION_BEATS.length - 1;
    this.elapsedMs = 0;
    this.skipped = true;
    return this.current;
  }
}
