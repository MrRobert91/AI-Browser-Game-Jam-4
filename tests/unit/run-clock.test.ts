import { describe, expect, it, vi } from 'vitest';

import { RUN_DURATION_SECONDS, RunClock } from '../../src/gameplay/run-clock';

describe('RunClock', () => {
  it('defaults to ten minutes and starts only on the first collapse', () => {
    const clock = new RunClock();
    clock.update(30);
    expect(clock.snapshot()).toMatchObject({
      phase: 'READY',
      elapsedSeconds: 0,
      remainingSeconds: RUN_DURATION_SECONDS.standard,
    });
    clock.notifyFirstCollapse();
    clock.update(1);
    expect(clock.snapshot().elapsedSeconds).toBe(1);
  });

  it('pauses for menu, hidden tabs and Seeds but not for death', () => {
    const clock = new RunClock();
    clock.notifyFirstCollapse();
    clock.setPaused('MENU', true);
    clock.update(2);
    clock.setPaused('MENU', false);
    clock.setPaused('HIDDEN', true);
    clock.update(2);
    clock.setPaused('HIDDEN', false);
    clock.setPaused('SEED', true);
    clock.update(1.5);
    clock.setPaused('SEED', false);
    clock.update(3); // death has no pause API by design
    expect(clock.snapshot().elapsedSeconds).toBe(3);
  });

  it('announces thresholds once, blocks commits at zero and always ends', () => {
    const onCountdown = vi.fn();
    const onEnding = vi.fn();
    const clock = new RunClock(
      { onCountdown, onEnding },
      { durationSeconds: 61 },
    );
    clock.notifyFirstCollapse();
    clock.update(2);
    clock.update(30);
    clock.update(40);
    clock.update(40);
    expect(onCountdown.mock.calls).toEqual([[60], [30]]);
    expect(onEnding).toHaveBeenCalledTimes(1);
    expect(clock.snapshot()).toMatchObject({
      phase: 'ENDING',
      remainingSeconds: 0,
      canCommit: false,
    });
  });

  it('supports optional five and fifteen minute modes', () => {
    expect(new RunClock({}, { mode: 'brief' }).snapshot().remainingSeconds).toBe(
      300,
    );
    expect(
      new RunClock({}, { mode: 'contemplative' }).snapshot().remainingSeconds,
    ).toBe(900);
  });
});
