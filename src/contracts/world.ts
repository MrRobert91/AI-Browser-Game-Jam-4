export type CellId = number;

export type WorldVector3 = readonly [number, number, number];

export interface CellCoordinates {
  readonly x: number;
  readonly z: number;
}

export type CellPhase =
  | 'UNINITIALIZED'
  | 'SUPERPOSED'
  | 'DETERMINED'
  | 'COLLAPSING'
  | 'FIXED';

export interface DomainMask {
  readonly lo: number;
  readonly hi: number;
}

export interface SolverCell {
  readonly phase: CellPhase;
  readonly terrain: DomainMask;
  readonly feature: DomainMask;
  readonly entropyTerrain: number;
  readonly entropyFeature: number;
  readonly observationCharge: number;
  readonly paletteEpoch: number;
  readonly fixedTerrainId: number | null;
  readonly fixedFeatureId: number | null;
}
