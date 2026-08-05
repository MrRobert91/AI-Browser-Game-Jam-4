import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId } from '../contracts/world';
import { staticHazardChance } from './distance-curves';

export const BODY_SAFETY_RADIUS_METERS = 2.5;
export const SPIKE_MINIMUM_DISTANCE_FROM_PLAYER_METERS = 4;
export const CRYSTAL_PULSE_SECONDS = 2.5;
export const FRAGILE_BREAK_DELAY_SECONDS = 0.8;
export const HAZARD_PHYSICS_ENABLE_PROGRESS = 0.7;

export type HazardType =
  'DEEP_WATER' | 'SPIKES' | 'CHARGED_CRYSTAL' | 'FRAGILE_GROUND';

export interface HazardPlacementCandidate {
  readonly cellId: CellId;
  readonly type: HazardType;
  readonly distanceFromOriginMeters: number;
  readonly distanceFromPlayerMeters: number;
  readonly onReservedAnchor: boolean;
  readonly onSafeCorridor: boolean;
  readonly hasSafeWaterExit: boolean;
  readonly unlockedPacks: ReadonlySet<UnlockablePackId>;
}

export interface HazardInstance {
  readonly cellId: CellId;
  readonly type: HazardType;
  readonly reducedFlashes: boolean;
  physical: boolean;
  fragileContactSeconds: number;
  crystalPhaseSeconds: number;
  broken: boolean;
}

export type HazardEvent =
  | {
      readonly type: 'LETHAL_CONTACT';
      readonly cellId: CellId;
      readonly hazardType: HazardType;
    }
  | {
      readonly type: 'CRYSTAL_PULSE';
      readonly cellId: CellId;
      readonly visualMode: 'EMISSIVE_PULSE' | 'SOFT_DISSOLVE';
    }
  | {
      readonly type: 'FRAGILE_BREAK';
      readonly cellId: CellId;
    };

function packRequired(type: HazardType): UnlockablePackId {
  return type === 'DEEP_WATER' ? 'water' : 'storm';
}

export function canPlaceHazard(candidate: HazardPlacementCandidate): boolean {
  if (!candidate.unlockedPacks.has(packRequired(candidate.type))) return false;
  if (candidate.distanceFromOriginMeters <= 14) return false;
  if (candidate.distanceFromPlayerMeters <= BODY_SAFETY_RADIUS_METERS) {
    return false;
  }
  if (candidate.onReservedAnchor || candidate.onSafeCorridor) return false;
  if (
    candidate.type === 'SPIKES' &&
    candidate.distanceFromPlayerMeters <
      SPIKE_MINIMUM_DISTANCE_FROM_PLAYER_METERS
  ) {
    return false;
  }
  if (candidate.type === 'DEEP_WATER' && !candidate.hasSafeWaterExit) {
    return false;
  }
  return true;
}

export function shouldPlaceHazard(
  candidate: HazardPlacementCandidate,
  deterministicRoll01: number,
): boolean {
  if (!Number.isFinite(deterministicRoll01)) return false;
  return (
    canPlaceHazard(candidate) &&
    deterministicRoll01 < staticHazardChance(candidate.distanceFromOriginMeters)
  );
}

export class HazardSystem {
  private readonly hazards = new Map<CellId, HazardInstance>();

  constructor(private readonly reducedFlashes: boolean) {}

  place(
    candidate: HazardPlacementCandidate,
    deterministicRoll01: number,
  ): HazardInstance | null {
    if (
      this.hazards.has(candidate.cellId) ||
      !shouldPlaceHazard(candidate, deterministicRoll01)
    ) {
      return null;
    }
    const instance: HazardInstance = {
      cellId: candidate.cellId,
      type: candidate.type,
      reducedFlashes: this.reducedFlashes,
      physical: false,
      fragileContactSeconds: 0,
      crystalPhaseSeconds: 0,
      broken: false,
    };
    this.hazards.set(candidate.cellId, instance);
    return instance;
  }

  setCollapseProgress(cellId: CellId, progress: number): boolean {
    const hazard = this.hazards.get(cellId);
    if (!hazard || hazard.physical) return false;
    if (progress < HAZARD_PHYSICS_ENABLE_PROGRESS) return false;
    hazard.physical = true;
    return true;
  }

  update(
    deltaSeconds: number,
    occupiedCellIds: ReadonlySet<CellId>,
  ): readonly HazardEvent[] {
    const delta = Math.max(0, deltaSeconds);
    const events: HazardEvent[] = [];
    for (const hazard of this.hazards.values()) {
      if (!hazard.physical || hazard.broken) continue;
      const occupied = occupiedCellIds.has(hazard.cellId);
      if (
        occupied &&
        (hazard.type === 'DEEP_WATER' || hazard.type === 'SPIKES')
      ) {
        events.push({
          type: 'LETHAL_CONTACT',
          cellId: hazard.cellId,
          hazardType: hazard.type,
        });
      }

      if (hazard.type === 'CHARGED_CRYSTAL') {
        const before = hazard.crystalPhaseSeconds;
        hazard.crystalPhaseSeconds =
          (hazard.crystalPhaseSeconds + delta) % CRYSTAL_PULSE_SECONDS;
        if (before + delta >= CRYSTAL_PULSE_SECONDS) {
          events.push({
            type: 'CRYSTAL_PULSE',
            cellId: hazard.cellId,
            visualMode: this.reducedFlashes
              ? 'SOFT_DISSOLVE'
              : 'EMISSIVE_PULSE',
          });
          if (occupied) {
            events.push({
              type: 'LETHAL_CONTACT',
              cellId: hazard.cellId,
              hazardType: hazard.type,
            });
          }
        }
      }

      if (hazard.type === 'FRAGILE_GROUND') {
        hazard.fragileContactSeconds = occupied
          ? hazard.fragileContactSeconds + delta
          : 0;
        if (
          occupied &&
          hazard.fragileContactSeconds >= FRAGILE_BREAK_DELAY_SECONDS
        ) {
          hazard.broken = true;
          events.push({ type: 'FRAGILE_BREAK', cellId: hazard.cellId });
        }
      }
    }
    return events;
  }

  get(cellId: CellId): HazardInstance | null {
    return this.hazards.get(cellId) ?? null;
  }
}
