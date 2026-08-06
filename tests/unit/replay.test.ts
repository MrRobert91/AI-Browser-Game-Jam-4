import { describe, expect, it } from 'vitest';

import {
  createSyntheticReplay,
  playReplayHeadless,
  ReplayRecorder,
} from '../../src/dev/replay';

describe('headless replay', () => {
  it('records quantized frames at strictly increasing 10 Hz ticks', () => {
    const recorder = new ReplayRecorder();
    expect(recorder.record(0, [64.04, 1.72, 63.96], [1, 0, 0])).toMatchObject({
      tick: 0,
      positionQ: [64, 1.7, 64],
    });
    expect(recorder.record(0, [1, 1, 1], [1, 0, 0])).toBeNull();
  });

  it('reconstructs the same hash without render', () => {
    const replay = createSyntheticReplay(0xa91f42c0, 120, 'spiral');
    const first = playReplayHeadless(0xa91f42c0, replay);
    const second = playReplayHeadless(0xa91f42c0, replay);
    expect(second).toEqual(first);
    expect(first.maximumCommitDistanceMeters).toBeLessThanOrEqual(10.01);
    expect(first.emptyDomains).toBe(0);
    expect(first.quantumVoidDebugCount).toBe(0);
  });
});
