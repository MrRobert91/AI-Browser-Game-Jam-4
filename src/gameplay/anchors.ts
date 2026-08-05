import type { UnlockablePackId } from '../contracts/tiles';
import type { CellCoordinates, CellId } from '../contracts/world';

export const ANCHOR_ORIGIN_CELL: CellCoordinates = { x: 32, z: 32 };
export const ANCHOR_CELL_SIZE_METERS = 2;
export const ANCHOR_ANGLE_SEPARATION_DEGREES = 55;
export const ANCHOR_MAX_LOCAL_ATTEMPTS = 3;

export interface AnchorRing {
  readonly packId: UnlockablePackId;
  readonly minimumMeters: number;
  readonly maximumMeters: number;
}

export const ANCHOR_RINGS: readonly AnchorRing[] = [
  { packId: 'water', minimumMeters: 10, maximumMeters: 14 },
  { packId: 'forest', minimumMeters: 20, maximumMeters: 26 },
  { packId: 'ruin', minimumMeters: 32, maximumMeters: 38 },
  { packId: 'storm', minimumMeters: 44, maximumMeters: 52 },
];

export interface SeedAnchorPlan {
  readonly packId: UnlockablePackId;
  readonly cellId: CellId;
  readonly coordinates: CellCoordinates;
  readonly angleDegrees: number;
  readonly distanceMeters: number;
  readonly reservedCellIds: readonly CellId[];
  readonly corridorCellIds: readonly CellId[];
  readonly fallbackMeadowCellIds: readonly CellId[];
  readonly attempts: number;
  readonly usedFallbackMeadow: boolean;
}

export interface MacroPlan {
  readonly worldSeed: number;
  readonly anchors: readonly SeedAnchorPlan[];
}

export interface AnchorPlannerOptions {
  readonly isCorridorCellSafe?: (
    cellId: CellId,
    packId: UnlockablePackId,
  ) => boolean;
}

interface CandidateCell {
  readonly coordinates: CellCoordinates;
  readonly cellId: CellId;
  readonly angleDegrees: number;
  readonly distanceMeters: number;
  readonly score: number;
}

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function random01(seed: number, salt: number): number {
  return mix32(seed ^ Math.imul(salt + 1, 0x9e3779b1)) / 0x1_0000_0000;
}

function normalizeAngle(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360;
}

export function angularDistanceDegrees(left: number, right: number): number {
  const difference = Math.abs(normalizeAngle(left) - normalizeAngle(right));
  return Math.min(difference, 360 - difference);
}

function coordinatesToId({ x, z }: CellCoordinates): CellId {
  return z * 64 + x;
}

function inWorld({ x, z }: CellCoordinates): boolean {
  return x >= 0 && z >= 0 && x < 64 && z < 64;
}

function coordinatesForRing(
  ring: AnchorRing,
  targetAngleDegrees: number,
  targetDistanceMeters: number,
  seed: number,
): readonly CandidateCell[] {
  const candidates: CandidateCell[] = [];
  for (let z = 0; z < 64; z += 1) {
    for (let x = 0; x < 64; x += 1) {
      const deltaX = (x - ANCHOR_ORIGIN_CELL.x) * ANCHOR_CELL_SIZE_METERS;
      const deltaZ = (z - ANCHOR_ORIGIN_CELL.z) * ANCHOR_CELL_SIZE_METERS;
      const distanceMeters = Math.hypot(deltaX, deltaZ);
      if (
        distanceMeters < ring.minimumMeters ||
        distanceMeters > ring.maximumMeters
      ) {
        continue;
      }
      const angleDegrees = normalizeAngle(
        (Math.atan2(deltaZ, deltaX) * 180) / Math.PI,
      );
      const angleError = angularDistanceDegrees(
        angleDegrees,
        targetAngleDegrees,
      );
      const distanceError = Math.abs(distanceMeters - targetDistanceMeters);
      const cellId = coordinatesToId({ x, z });
      const stableNoise = random01(seed, cellId) * 0.001;
      candidates.push({
        coordinates: { x, z },
        cellId,
        angleDegrees,
        distanceMeters,
        score: angleError * 4 + distanceError + stableNoise,
      });
    }
  }
  return candidates.sort(
    (left, right) => left.score - right.score || left.cellId - right.cellId,
  );
}

function lineCells(
  start: CellCoordinates,
  end: CellCoordinates,
): readonly CellCoordinates[] {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaZ));
  const cells: CellCoordinates[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps === 0 ? 0 : step / steps;
    cells.push({
      x: Math.round(start.x + deltaX * ratio),
      z: Math.round(start.z + deltaZ * ratio),
    });
  }
  return cells;
}

export function createTwoCellCorridor(
  anchor: CellCoordinates,
): readonly CellId[] {
  const centerLine = lineCells(ANCHOR_ORIGIN_CELL, anchor);
  const mostlyHorizontal =
    Math.abs(anchor.x - ANCHOR_ORIGIN_CELL.x) >=
    Math.abs(anchor.z - ANCHOR_ORIGIN_CELL.z);
  const ids = new Set<CellId>();
  for (const cell of centerLine) {
    const companion = mostlyHorizontal
      ? { x: cell.x, z: cell.z + 1 }
      : { x: cell.x + 1, z: cell.z };
    if (inWorld(cell)) ids.add(coordinatesToId(cell));
    if (inWorld(companion)) ids.add(coordinatesToId(companion));
  }
  return [...ids].sort((left, right) => left - right);
}

export function createAnchorReservation(
  anchor: CellCoordinates,
): readonly CellId[] {
  const ids: CellId[] = [];
  for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const coordinates = {
        x: anchor.x + offsetX,
        z: anchor.z + offsetZ,
      };
      if (inWorld(coordinates)) ids.push(coordinatesToId(coordinates));
    }
  }
  return ids.sort((left, right) => left - right);
}

export function planSeedAnchors(
  worldSeed: number,
  options: AnchorPlannerOptions = {},
): MacroPlan {
  const baseAngle = random01(worldSeed, 0) * 360;
  const anchors: SeedAnchorPlan[] = [];

  for (let index = 0; index < ANCHOR_RINGS.length; index += 1) {
    const ring = ANCHOR_RINGS[index]!;
    const jitterDegrees = (random01(worldSeed, index + 11) - 0.5) * 16;
    const targetAngle = normalizeAngle(baseAngle + index * 90 + jitterDegrees);
    const targetDistance =
      ring.minimumMeters +
      random01(worldSeed, index + 29) *
        (ring.maximumMeters - ring.minimumMeters);
    const candidates = coordinatesForRing(
      ring,
      targetAngle,
      targetDistance,
      worldSeed,
    );
    if (candidates.length === 0) {
      throw new Error(`No candidate cells exist for ${ring.packId}.`);
    }

    let selected = candidates[0]!;
    let corridor = createTwoCellCorridor(selected.coordinates);
    let attempts = 0;
    let accepted = false;
    while (attempts < ANCHOR_MAX_LOCAL_ATTEMPTS) {
      selected = candidates[attempts] ?? candidates[0]!;
      corridor = createTwoCellCorridor(selected.coordinates);
      attempts += 1;
      if (
        corridor.every(
          (cellId) => options.isCorridorCellSafe?.(cellId, ring.packId) ?? true,
        )
      ) {
        accepted = true;
        break;
      }
    }

    const reservation = createAnchorReservation(selected.coordinates);
    anchors.push({
      packId: ring.packId,
      cellId: selected.cellId,
      coordinates: selected.coordinates,
      angleDegrees: selected.angleDegrees,
      distanceMeters: selected.distanceMeters,
      reservedCellIds: reservation,
      corridorCellIds: corridor,
      fallbackMeadowCellIds: accepted ? [] : reservation,
      attempts,
      usedFallbackMeadow: !accepted,
    });
  }

  return { worldSeed: worldSeed >>> 0, anchors };
}
