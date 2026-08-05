import { describe, expect, it } from 'vitest';

import type {
  ChunkBoundaryEvent,
  ObservationInput,
} from '../../src/contracts/messages';
import {
  isWorkerInput,
  isWorkerOutput,
} from '../../src/contracts/runtime-validation';
import { getWorkerOutputTransferables } from '../../src/contracts/transferables';
import { handleWorkerInput } from '../../src/wfc/worker-runtime';

describe('public worker contracts', () => {
  it('roundtrips a numbered observation tick through the echo runtime', () => {
    const input: ObservationInput = {
      type: 'OBSERVATION_TICK',
      tick: 37,
      playerPosition: [64, 1.7, 64],
      cameraForward: [0, 0, -1],
      visibleCells: [
        { cellId: 2080, distance: 4, alignment: 0.8, lineOfSight: true },
      ],
    };

    expect(isWorkerInput(input)).toBe(true);

    const output = handleWorkerInput(structuredClone(input));

    expect(isWorkerOutput(output)).toBe(true);
    expect(output).toMatchObject({
      type: 'SOLVER_WARNING',
      code: 'ECHO_ONLY',
      tick: 37,
    });
  });

  it('rejects invalid messages without trusting their payload', () => {
    const output = handleWorkerInput({
      type: 'OBSERVATION_TICK',
      tick: 4,
      playerPosition: [Number.NaN, 1.7, 64],
      cameraForward: [0, 0, -1],
      visibleCells: [],
    });

    expect(output).toEqual({
      type: 'SOLVER_WARNING',
      tick: 4,
      code: 'INVALID_INPUT',
      message: 'Rejected invalid worker input.',
    });
  });

  it('transfers every chunk boundary buffer without copying', () => {
    const event: ChunkBoundaryEvent = {
      type: 'BOUNDARY_UPDATE',
      chunkId: 9,
      north: new Uint16Array([1, 2]),
      east: new Uint16Array([3, 4]),
      south: new Uint16Array([5, 6]),
      west: new Uint16Array([7, 8]),
    };
    const transferables = getWorkerOutputTransferables(event);

    expect(transferables).toHaveLength(4);

    const clone = structuredClone(event, { transfer: transferables });

    expect(event.north.byteLength).toBe(0);
    expect(event.east.byteLength).toBe(0);
    expect(event.south.byteLength).toBe(0);
    expect(event.west.byteLength).toBe(0);
    expect([
      ...clone.north,
      ...clone.east,
      ...clone.south,
      ...clone.west,
    ]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
