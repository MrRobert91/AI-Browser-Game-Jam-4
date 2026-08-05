import type { CellId } from '../contracts/world';
import { maximumActiveEnemies } from './distance-curves';

export const UNCERTAINTY_MINIMUM_ORIGIN_DISTANCE_METERS = 18;
export const UNCERTAINTY_MINIMUM_PLAYER_DISTANCE_METERS = 8;
export const UNCERTAINTY_PETRIFY_SECONDS = 1.2;
export const UNCERTAINTY_GAZE_GRACE_SECONDS = 0.4;
export const UNCERTAINTY_REWARD_SECONDS = 3;
export const UNCERTAINTY_MAX_ACTIVE = 4;
export const UNCERTAINTY_MAX_STORM_GUARDIANS = 2;
export const UNCERTAINTY_MINIMUM_FIXED_CELLS = 60;
export const UNCERTAINTY_MOVE_INTERVAL_SECONDS = 0.45;

export type UncertaintyState =
  'DORMANT' | 'STALKING' | 'SEEN' | 'PETRIFYING' | 'FIXED_STATUE' | 'CONTACT';

export interface UncertaintySpawnCandidate {
  readonly id: number;
  readonly cellId: CellId;
  readonly distanceFromOriginMeters: number;
  readonly distanceFromPlayerMeters: number;
  readonly fixedCells: number;
  readonly stormGuardian: boolean;
}

export interface UncertaintyNeighbor {
  readonly cellId: CellId;
  readonly walkable: boolean;
  readonly visible: boolean;
}

export interface UncertaintyUpdateInput {
  readonly deltaSeconds: number;
  readonly observedInCentralCone: boolean;
  readonly playerContact: boolean;
  readonly neighbors: readonly UncertaintyNeighbor[];
}

export interface UncertaintySnapshot {
  readonly id: number;
  readonly cellId: CellId;
  readonly state: UncertaintyState;
  readonly gazeProgressSeconds: number;
  readonly graceRemainingSeconds: number;
  readonly stormGuardian: boolean;
  readonly rewardGranted: boolean;
}

export type UncertaintyEvent =
  | {
      readonly type: 'MOVED';
      readonly id: number;
      readonly fromCellId: CellId;
      readonly toCellId: CellId;
    }
  | { readonly type: 'PLAYER_DEATH'; readonly id: number }
  | {
      readonly type: 'FIXED_STATUE';
      readonly id: number;
      readonly rewardSeconds: number;
    };

interface MutableUncertainty {
  id: number;
  cellId: CellId;
  state: UncertaintyState;
  gazeProgressSeconds: number;
  graceRemainingSeconds: number;
  stormGuardian: boolean;
  rewardGranted: boolean;
  movementAccumulatorSeconds: number;
  moves: number;
}

function chooseNeighbor(
  enemy: MutableUncertainty,
  neighbors: readonly UncertaintyNeighbor[],
): UncertaintyNeighbor | null {
  const legal = neighbors
    .filter((neighbor) => neighbor.walkable && !neighbor.visible)
    .sort((left, right) => left.cellId - right.cellId);
  if (legal.length === 0) return null;
  const mixed = Math.imul(enemy.id ^ enemy.moves, 0x45d9f3b) >>> 0;
  return legal[mixed % legal.length] ?? null;
}

export class UncertaintySystem {
  private readonly enemies = new Map<number, MutableUncertainty>();

  spawn(candidate: UncertaintySpawnCandidate): UncertaintySnapshot | null {
    if (
      this.enemies.has(candidate.id) ||
      candidate.fixedCells < UNCERTAINTY_MINIMUM_FIXED_CELLS ||
      candidate.distanceFromOriginMeters <
        UNCERTAINTY_MINIMUM_ORIGIN_DISTANCE_METERS ||
      candidate.distanceFromPlayerMeters <
        UNCERTAINTY_MINIMUM_PLAYER_DISTANCE_METERS ||
      this.activeCount() >=
        Math.min(
          UNCERTAINTY_MAX_ACTIVE,
          maximumActiveEnemies(candidate.distanceFromOriginMeters),
        )
    ) {
      return null;
    }
    if (
      candidate.stormGuardian &&
      [...this.enemies.values()].filter(
        (enemy) => enemy.stormGuardian && enemy.state !== 'FIXED_STATUE',
      ).length >= UNCERTAINTY_MAX_STORM_GUARDIANS
    ) {
      return null;
    }

    const enemy: MutableUncertainty = {
      id: candidate.id,
      cellId: candidate.cellId,
      state: 'DORMANT',
      gazeProgressSeconds: 0,
      graceRemainingSeconds: 0,
      stormGuardian: candidate.stormGuardian,
      rewardGranted: false,
      movementAccumulatorSeconds: 0,
      moves: 0,
    };
    this.enemies.set(enemy.id, enemy);
    return this.snapshotOf(enemy);
  }

  update(
    id: number,
    input: UncertaintyUpdateInput,
  ): readonly UncertaintyEvent[] {
    const enemy = this.enemies.get(id);
    if (!enemy || enemy.state === 'FIXED_STATUE') return [];
    const delta = Math.max(0, input.deltaSeconds);
    const events: UncertaintyEvent[] = [];

    if (input.observedInCentralCone) {
      enemy.state = enemy.gazeProgressSeconds === 0 ? 'SEEN' : 'PETRIFYING';
      enemy.gazeProgressSeconds += delta;
      enemy.graceRemainingSeconds = UNCERTAINTY_GAZE_GRACE_SECONDS;
      enemy.movementAccumulatorSeconds = 0;
      if (enemy.gazeProgressSeconds >= UNCERTAINTY_PETRIFY_SECONDS) {
        enemy.state = 'FIXED_STATUE';
        if (!enemy.rewardGranted) {
          enemy.rewardGranted = true;
          events.push({
            type: 'FIXED_STATUE',
            id,
            rewardSeconds: UNCERTAINTY_REWARD_SECONDS,
          });
        }
      }
      return events;
    }

    if (input.playerContact) {
      enemy.state = 'CONTACT';
      events.push({ type: 'PLAYER_DEATH', id });
      return events;
    }

    if (enemy.gazeProgressSeconds > 0) {
      enemy.graceRemainingSeconds = Math.max(
        0,
        enemy.graceRemainingSeconds - delta,
      );
      if (enemy.graceRemainingSeconds > 0) {
        enemy.state = 'SEEN';
        return events;
      }
      enemy.gazeProgressSeconds = 0;
    }

    enemy.state = 'STALKING';
    enemy.movementAccumulatorSeconds += delta;
    if (enemy.movementAccumulatorSeconds >= UNCERTAINTY_MOVE_INTERVAL_SECONDS) {
      enemy.movementAccumulatorSeconds %= UNCERTAINTY_MOVE_INTERVAL_SECONDS;
      const destination = chooseNeighbor(enemy, input.neighbors);
      if (destination) {
        const fromCellId = enemy.cellId;
        enemy.cellId = destination.cellId;
        enemy.moves += 1;
        events.push({
          type: 'MOVED',
          id,
          fromCellId,
          toCellId: destination.cellId,
        });
      }
    }
    return events;
  }

  get(id: number): UncertaintySnapshot | null {
    const enemy = this.enemies.get(id);
    return enemy ? this.snapshotOf(enemy) : null;
  }

  activeCount(): number {
    return [...this.enemies.values()].filter(
      (enemy) => enemy.state !== 'FIXED_STATUE',
    ).length;
  }

  private snapshotOf(enemy: MutableUncertainty): UncertaintySnapshot {
    return {
      id: enemy.id,
      cellId: enemy.cellId,
      state: enemy.state,
      gazeProgressSeconds: enemy.gazeProgressSeconds,
      graceRemainingSeconds: enemy.graceRemainingSeconds,
      stormGuardian: enemy.stormGuardian,
      rewardGranted: enemy.rewardGranted,
    };
  }
}
