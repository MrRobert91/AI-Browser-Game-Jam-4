import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId, WorldVector3 } from '../contracts/world';

export interface AttentionPortrait {
  readonly fixedCells: number;
  readonly uniqueTerrainTiles: number;
  readonly uniqueFeatureTiles: number;
  readonly unlockedPacks: readonly string[];
  readonly deaths: number;
  readonly dangerExposureSeconds: number;
  readonly averageGazeDwell: number;
  readonly revisitRatio: number;
  readonly maxDistance: number;
  readonly waterRatio: number;
  readonly forestRatio: number;
  readonly ruinRatio: number;
  readonly unresolvedVisibleCells: number;
}

export type AttentionProfile =
  | 'Jardinero'
  | 'Cartógrafo'
  | 'Guardián'
  | 'Testigo'
  | 'Impaciente';

export interface FixedAttentionCell {
  readonly cellId: CellId;
  readonly terrainTileId: number;
  readonly featureTileId: number | null;
  readonly family?: 'water' | 'forest' | 'ruin' | 'base';
}

const PROFILE_ORDER: readonly AttentionProfile[] = [
  'Jardinero',
  'Cartógrafo',
  'Guardián',
  'Testigo',
  'Impaciente',
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function classifyAttentionPortrait(
  portrait: AttentionPortrait,
): AttentionProfile {
  const distance = clamp01(portrait.maxDistance / 52);
  const diversity = clamp01(
    (portrait.uniqueTerrainTiles + portrait.uniqueFeatureTiles) / 18,
  );
  const dwell = clamp01(portrait.averageGazeDwell / 2.2);
  const danger = clamp01(portrait.dangerExposureSeconds / 90);
  const safety = 1 - clamp01(portrait.deaths / 4);
  const concentration = 1 - clamp01(portrait.fixedCells / 240);

  const scores: Readonly<Record<AttentionProfile, number>> = {
    Jardinero:
      portrait.forestRatio * 2.4 +
      portrait.revisitRatio * 1.8 +
      (1 - distance) * 0.7,
    Cartógrafo: distance * 2.3 + diversity * 1.6 + (1 - concentration) * 0.4,
    Guardián:
      safety * 1.8 + portrait.revisitRatio * 1.4 + (1 - danger) * 0.8,
    Testigo: dwell * 2.4 + concentration * 1.5 + (1 - danger) * 0.3,
    Impaciente:
      distance * 1.5 + danger * 1.5 + (1 - dwell) * 1.2 + (1 - safety) * 0.3,
  };

  return PROFILE_ORDER.reduce((selected, candidate) =>
    scores[candidate] > scores[selected] ? candidate : selected,
  );
}

export class AttentionPortraitTracker {
  private readonly terrainTiles = new Set<number>();
  private readonly featureTiles = new Set<number>();
  private readonly fixedCellIds = new Set<CellId>();
  private readonly unlockedPacks = new Set<UnlockablePackId>();
  private readonly gazeVisits = new Map<CellId, number>();
  private fixedWater = 0;
  private fixedForest = 0;
  private fixedRuin = 0;
  private deaths = 0;
  private dangerExposureSeconds = 0;
  private gazeDwellTotal = 0;
  private gazeDwellSamples = 0;
  private revisits = 0;
  private maxDistance = 0;
  private unresolvedVisibleCells = 0;

  recordFixedCell(cell: FixedAttentionCell): void {
    if (this.fixedCellIds.has(cell.cellId)) return;
    this.fixedCellIds.add(cell.cellId);
    this.terrainTiles.add(cell.terrainTileId);
    if (cell.featureTileId !== null) this.featureTiles.add(cell.featureTileId);
    if (cell.family === 'water') this.fixedWater += 1;
    if (cell.family === 'forest') this.fixedForest += 1;
    if (cell.family === 'ruin') this.fixedRuin += 1;
  }

  recordGaze(cellId: CellId, dwellSeconds: number): void {
    const dwell = Math.max(0, dwellSeconds);
    if (dwell === 0) return;
    const previousVisits = this.gazeVisits.get(cellId) ?? 0;
    if (previousVisits > 0) this.revisits += 1;
    this.gazeVisits.set(cellId, previousVisits + 1);
    this.gazeDwellTotal += dwell;
    this.gazeDwellSamples += 1;
  }

  recordFrame(input: {
    readonly deltaSeconds: number;
    readonly playerPosition: WorldVector3;
    readonly inDanger: boolean;
    readonly unresolvedVisibleCells: number;
  }): void {
    const distance = Math.hypot(
      input.playerPosition[0] - 64,
      input.playerPosition[2] - 64,
    );
    this.maxDistance = Math.max(this.maxDistance, distance);
    if (input.inDanger) {
      this.dangerExposureSeconds += Math.max(0, input.deltaSeconds);
    }
    this.unresolvedVisibleCells = Math.max(0, input.unresolvedVisibleCells);
  }

  recordUnlock(packId: UnlockablePackId): void {
    this.unlockedPacks.add(packId);
  }

  recordDeath(): void {
    this.deaths += 1;
  }

  snapshot(): AttentionPortrait {
    const fixedCells = this.fixedCellIds.size;
    const gazeEvents = [...this.gazeVisits.values()].reduce(
      (total, visits) => total + visits,
      0,
    );
    return {
      fixedCells,
      uniqueTerrainTiles: this.terrainTiles.size,
      uniqueFeatureTiles: this.featureTiles.size,
      unlockedPacks: [...this.unlockedPacks].sort(),
      deaths: this.deaths,
      dangerExposureSeconds: this.dangerExposureSeconds,
      averageGazeDwell:
        this.gazeDwellSamples === 0
          ? 0
          : this.gazeDwellTotal / this.gazeDwellSamples,
      revisitRatio: gazeEvents === 0 ? 0 : this.revisits / gazeEvents,
      maxDistance: this.maxDistance,
      waterRatio: fixedCells === 0 ? 0 : this.fixedWater / fixedCells,
      forestRatio: fixedCells === 0 ? 0 : this.fixedForest / fixedCells,
      ruinRatio: fixedCells === 0 ? 0 : this.fixedRuin / fixedCells,
      unresolvedVisibleCells: this.unresolvedVisibleCells,
    };
  }
}
