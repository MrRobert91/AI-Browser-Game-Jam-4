export type Direction = 'N' | 'E' | 'S' | 'W';

export type SocketId =
  | 'OPEN_FLAT'
  | 'WET_FLAT'
  | 'BANK_IN'
  | 'BANK_OUT'
  | 'PATH'
  | 'RUIN_FLOOR'
  | 'CLIFF_LOW';

export type TilePackId = 'base' | 'water' | 'forest' | 'ruin' | 'storm';
export type UnlockablePackId = Exclude<TilePackId, 'base'>;

export interface TerrainTileDefinition {
  readonly id: string;
  readonly numericId: number;
  readonly packId: string;
  readonly weight: number;
  readonly mesh: string;
  readonly rotationQuarterTurns: readonly (0 | 1 | 2 | 3)[];
  readonly sockets: Readonly<Record<Direction, SocketId>>;
  readonly tags: readonly string[];
  readonly walkable: boolean;
  readonly lethal: boolean;
  readonly heightClass: 0 | 1;
  readonly fallbackRank: 0 | 1 | 2;
  readonly distanceCurve?: readonly (readonly [number, number])[];
  readonly neighborBias?: Readonly<Record<string, number>>;
}

export interface FeatureTileDefinition {
  readonly id: string;
  readonly numericId: number;
  readonly packId: string;
  readonly weight: number;
  readonly mesh: string | null;
  readonly tags: readonly string[];
  readonly allowedTerrainTags: readonly string[];
  readonly forbiddenWithinMetersOf: Readonly<Record<string, number>>;
  readonly minDistanceFromOrigin: number;
  readonly maxSlopeDegrees: number;
  readonly blocksMovement: boolean;
  readonly lethal: boolean;
  readonly uniquePerChunk?: boolean;
  readonly neighborBias?: Readonly<Record<string, number>>;
}
