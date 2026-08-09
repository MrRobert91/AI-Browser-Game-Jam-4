import { describe, expect, it } from 'vitest';
import {
  AgencyIntroduction,
  INTRODUCTION_BEATS,
  INTRODUCTION_BEAT_MS,
  INTRODUCTION_MAX_MS,
} from '../../src/gameplay/introduction';

describe('Agency introduction', () => {
  it('presents the chamber, provisional certification, intervention and mandatory line', () => {
    expect(INTRODUCTION_BEATS.map((beat) => beat.id)).toEqual([
      'chamber',
      'agency',
      'question',
      'look',
    ]);
    expect(INTRODUCTION_BEATS.at(-1)?.text).toBe(
      'Mira. Lo que permanezca bajo tu atención tendrá derecho a existir.',
    );
    expect(INTRODUCTION_MAX_MS).toBeLessThanOrEqual(35_000);
  });

  it('advances deterministically and can be skipped without waiting', () => {
    const intro = new AgencyIntroduction();
    intro.advance(INTRODUCTION_BEAT_MS * 2);
    expect(intro.current.id).toBe('question');
    expect(intro.complete).toBe(false);
    expect(intro.skip().id).toBe('look');
    expect(intro.complete).toBe(true);
    expect(intro.wasSkipped).toBe(true);
  });
});
