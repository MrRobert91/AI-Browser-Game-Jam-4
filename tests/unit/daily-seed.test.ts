import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_REPLAY_SEED,
  dailySeedForDate,
  resolveWorldSeed,
  utcDateKey,
} from '../../src/gameplay/daily-seed';

describe('daily world seed', () => {
  it('derives the same shared seed from the same UTC calendar date offline', () => {
    const beforeMidnight = new Date('2026-08-09T00:05:00+02:00');
    const sameUtcDay = new Date('2026-08-08T23:55:00Z');
    expect(utcDateKey(beforeMidnight)).toBe('2026-08-08');
    expect(dailySeedForDate(beforeMidnight)).toBe(dailySeedForDate(sameUtcDay));
    const selection = resolveWorldSeed(
      new URLSearchParams('daily=1'),
      sameUtcDay,
    );
    expect(selection).toEqual({
      worldSeed: dailySeedForDate(sameUtcDay),
      mode: 'daily',
      dateKey: '2026-08-08',
    });
  });

  it('preserves explicit/replay determinism and a secure-random standard mode', () => {
    expect(
      resolveWorldSeed(new URLSearchParams('seed=1234-ABCD')),
    ).toMatchObject({ worldSeed: 0x1234abcd, mode: 'explicit' });
    expect(resolveWorldSeed(new URLSearchParams('replay=wp5'))).toMatchObject({
      worldSeed: CANONICAL_REPLAY_SEED,
      mode: 'replay',
    });
    const random = vi.fn(() => 0xfeedbeef);
    expect(resolveWorldSeed(new URLSearchParams(), new Date(), random)).toEqual(
      {
        worldSeed: 0xfeedbeef,
        mode: 'random',
        dateKey: null,
      },
    );
    expect(random).toHaveBeenCalledOnce();
  });
});
