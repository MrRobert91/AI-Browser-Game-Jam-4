import introduction from '../content/introduction.json';
import type { Locale } from '../contracts/localization';

export interface IntroductionBeat {
  readonly id: string;
  readonly eyebrow: string;
  readonly text: string;
}

export const INTRODUCTION_BEAT_MS = 8_000;
export const INTRODUCTION_MAX_MS = INTRODUCTION_BEAT_MS * introduction.length;

export const INTRODUCTION_BEATS: readonly IntroductionBeat[] = introduction;

const ENGLISH_INTRODUCTION_BEATS: readonly IntroductionBeat[] = [
  {
    id: 'assignment',
    eyebrow: 'AGENCY // SILENCE CHAMBER 7-C',
    text: 'Possibility Condensate stable. A field body has been assigned to the last certified Collapser.',
  },
  {
    id: 'instrument',
    eyebrow: 'THE MEASURE // LOCAL INSTRUMENT',
    text: 'Your attention establishes a measurement basis. The Agency accepts no liability for the resulting landscape.',
  },
  {
    id: 'ready',
    eyebrow: 'CALIBRATION // READY',
    text: 'Look. What remains under your attention will earn the right to exist.',
  },
];

export class AgencyIntroduction {
  private index = 0;
  private elapsedMs = 0;
  private skipped = false;

  constructor(private readonly locale: Locale = 'es') {}

  private get beats(): readonly IntroductionBeat[] {
    return this.locale === 'en' ? ENGLISH_INTRODUCTION_BEATS : INTRODUCTION_BEATS;
  }

  get current(): IntroductionBeat {
    return this.beats[this.index] ?? this.beats[0]!;
  }

  get complete(): boolean {
    return this.index === this.beats.length - 1;
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
    this.index = this.beats.length - 1;
    this.elapsedMs = 0;
    this.skipped = true;
    return this.current;
  }
}
