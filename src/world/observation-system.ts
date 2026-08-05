import type {
  ObservationInput,
  VisibleCellObservation,
} from '../contracts/messages';
import type { CellId, WorldVector3 } from '../contracts/world';
import {
  WORLD_CELL_SIZE_METERS,
  WorldState,
  cellCenterToWorld,
} from './world-state';

export const OBSERVATION_RADIUS_METERS = 10;
export const CONTACT_RADIUS_METERS = 2.5;
export const OBSERVATION_HALF_ANGLE_DEGREES = 30;
export const OBSERVATION_TICK_SECONDS = 0.1;
export const OBSERVATION_CHARGE_PER_SECOND = 1.4;
export const OBSERVATION_DECAY_PER_SECOND = 0.55;

const COS_HALF_ANGLE = Math.cos(
  (OBSERVATION_HALF_ANGLE_DEGREES * Math.PI) / 180,
);

export interface ObservationFrame {
  readonly deltaSeconds: number;
  readonly playerPosition: WorldVector3;
  readonly cameraForward: WorldVector3;
  readonly nearbyCellIds: readonly CellId[];
}

export interface ObservationTickResult {
  readonly input: ObservationInput;
  readonly contactCellIds: readonly CellId[];
  readonly attentionByCell: ReadonlyMap<CellId, number>;
}

export type LineOfSightTest = (
  from: WorldVector3,
  to: WorldVector3,
  cellId: CellId,
) => boolean;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function normalize(vector: WorldVector3): WorldVector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= Number.EPSILON) {
    return [0, 0, -1];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function vectorTo(
  from: WorldVector3,
  to: WorldVector3,
): { readonly direction: WorldVector3; readonly distance: number } {
  const delta: WorldVector3 = [
    to[0] - from[0],
    to[1] - from[1],
    to[2] - from[2],
  ];
  const distance = Math.hypot(delta[0], delta[1], delta[2]);
  return { direction: normalize(delta), distance };
}

function dot(left: WorldVector3, right: WorldVector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * Samples the camera at a fixed 10 Hz so solver results do not depend on the
 * render frame rate. The line-of-sight adapter is supplied by the main thread.
 */
export class ObservationSystem {
  private accumulatorSeconds = 0;
  private tick = 0;

  constructor(
    private readonly worldState: WorldState,
    private readonly hasLineOfSight: LineOfSightTest = () => true,
  ) {}

  update(frame: ObservationFrame): readonly ObservationTickResult[] {
    this.accumulatorSeconds += Math.max(0, frame.deltaSeconds);
    const results: ObservationTickResult[] = [];
    while (this.accumulatorSeconds + Number.EPSILON >= OBSERVATION_TICK_SECONDS) {
      this.accumulatorSeconds -= OBSERVATION_TICK_SECONDS;
      results.push(this.sample(frame));
    }
    return results;
  }

  reset(tick = 0): void {
    this.accumulatorSeconds = 0;
    this.tick = tick;
  }

  private sample(frame: ObservationFrame): ObservationTickResult {
    const forward = normalize(frame.cameraForward);
    const visibleCells: VisibleCellObservation[] = [];
    const contactCellIds: CellId[] = [];
    const attentionByCell = new Map<CellId, number>();

    for (const cellId of frame.nearbyCellIds) {
      const center = cellCenterToWorld(cellId, frame.playerPosition[1]);
      const { direction, distance } = vectorTo(frame.playerPosition, center);
      if (distance > OBSERVATION_RADIUS_METERS + WORLD_CELL_SIZE_METERS / 2) {
        continue;
      }

      if (this.worldState.getCell(cellId).phase === 'UNINITIALIZED') {
        this.worldState.initializeCell(cellId);
      }

      if (distance <= CONTACT_RADIUS_METERS) {
        contactCellIds.push(cellId);
      }

      const lineOfSight =
        distance <= OBSERVATION_RADIUS_METERS &&
        this.hasLineOfSight(frame.playerPosition, center, cellId);
      const alignment = clamp01(
        (dot(forward, direction) - COS_HALF_ANGLE) / (1 - COS_HALF_ANGLE),
      );
      const focus = smoothstep(0, 1, alignment);
      const proximity =
        1 -
        smoothstep(
          CONTACT_RADIUS_METERS,
          OBSERVATION_RADIUS_METERS,
          distance,
        );
      const attention = lineOfSight ? focus * proximity : 0;
      attentionByCell.set(cellId, attention);

      const cell = this.worldState.getCell(cellId);
      if (cell.phase !== 'FIXED') {
        const chargeDelta =
          attention > 0
            ? OBSERVATION_TICK_SECONDS *
              attention *
              OBSERVATION_CHARGE_PER_SECOND
            : -OBSERVATION_TICK_SECONDS * OBSERVATION_DECAY_PER_SECOND;
        this.worldState.setObservationCharge(
          cellId,
          cell.observationCharge + chargeDelta,
        );
      }

      if (distance <= OBSERVATION_RADIUS_METERS) {
        visibleCells.push({ cellId, distance, alignment, lineOfSight });
      }
    }

    this.tick += 1;
    return {
      input: {
        type: 'OBSERVATION_TICK',
        tick: this.tick,
        playerPosition: [...frame.playerPosition],
        cameraForward: forward,
        visibleCells,
      },
      contactCellIds,
      attentionByCell,
    };
  }
}
