import type { Direction } from '../contracts/tiles';

export const BOUNDARY_LENGTH = 16;
export const UNCONSTRAINED_TILE = 0xffff;

export interface BoundaryConstraint {
  readonly north: Uint16Array;
  readonly east: Uint16Array;
  readonly south: Uint16Array;
  readonly west: Uint16Array;
}

export const BOUNDARY_KEY: Readonly<
  Record<Direction, keyof BoundaryConstraint>
> = {
  N: 'north',
  E: 'east',
  S: 'south',
  W: 'west',
};

export const OPPOSITE_BOUNDARY: Readonly<Record<Direction, Direction>> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export function createBoundaryConstraint(): BoundaryConstraint {
  return {
    north: unconstrainedEdge(),
    east: unconstrainedEdge(),
    south: unconstrainedEdge(),
    west: unconstrainedEdge(),
  };
}

export function cloneBoundaryConstraint(
  boundary: BoundaryConstraint,
): BoundaryConstraint {
  return {
    north: boundary.north.slice(),
    east: boundary.east.slice(),
    south: boundary.south.slice(),
    west: boundary.west.slice(),
  };
}

export function setBoundaryEdge(
  boundary: BoundaryConstraint,
  direction: Direction,
  values: Uint16Array,
): void {
  assertBoundaryEdge(values);
  boundary[BOUNDARY_KEY[direction]].set(values);
}

export function boundaryEdge(
  boundary: BoundaryConstraint,
  direction: Direction,
): Uint16Array {
  return boundary[BOUNDARY_KEY[direction]];
}

export function hasBoundaryConstraint(boundary: BoundaryConstraint): boolean {
  return (
    edgeHasConstraint(boundary.north) ||
    edgeHasConstraint(boundary.east) ||
    edgeHasConstraint(boundary.south) ||
    edgeHasConstraint(boundary.west)
  );
}

export function assertBoundaryEdge(values: Uint16Array): void {
  if (values.length !== BOUNDARY_LENGTH) {
    throw new RangeError(
      `boundary edge must contain ${BOUNDARY_LENGTH} values`,
    );
  }
}

function unconstrainedEdge(): Uint16Array {
  const edge = new Uint16Array(BOUNDARY_LENGTH);
  edge.fill(UNCONSTRAINED_TILE);
  return edge;
}

function edgeHasConstraint(edge: Uint16Array): boolean {
  return edge.some((value) => value !== UNCONSTRAINED_TILE);
}
