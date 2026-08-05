import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId } from '../contracts/world';
import type { MacroPlan } from './anchors';

export const SEED_PACK_ORDER = [
  'water',
  'forest',
  'ruin',
  'storm',
] as const satisfies readonly UnlockablePackId[];
export const SEED_COLLECTION_PAUSE_SECONDS = 1.5;

export type PackProgressState = 'LOCKED' | 'AVAILABLE' | 'COLLECTED';

export interface SeedCollectionEvent {
  readonly type: 'SEED_COLLECTED';
  readonly packId: UnlockablePackId;
  readonly cellId: CellId;
  readonly paletteEpoch: number;
  readonly pauseSeconds: number;
  readonly previewSilhouettes: readonly [string, string, string];
  readonly narrativeLine: string;
  readonly musicStemId: string;
}

export interface ProgressionSnapshot {
  readonly collectedPacks: readonly UnlockablePackId[];
  readonly nextPack: UnlockablePackId | null;
  readonly pauseRemainingSeconds: number;
  readonly paletteEpoch: number;
  readonly packStates: Readonly<Record<UnlockablePackId, PackProgressState>>;
}

export interface ProgressionOptions {
  readonly unlockPack: (packId: UnlockablePackId) => number;
  readonly onSeedCollected?: (event: SeedCollectionEvent) => void;
}

const PACK_PRESENTATION: Readonly<
  Record<
    UnlockablePackId,
    {
      readonly preview: readonly [string, string, string];
      readonly narrative: string;
      readonly stem: string;
    }
  >
> = {
  water: {
    preview: ['shore', 'reeds', 'spring'],
    narrative: 'El agua no estaba ausente. Todavía no era posible.',
    stem: 'stem-water',
  },
  forest: {
    preview: ['young-tree', 'old-tree', 'mushrooms'],
    narrative: 'Una forma aprendida permite que otra eche raíces.',
    stem: 'stem-forest',
  },
  ruin: {
    preview: ['arch', 'column', 'statue'],
    narrative: 'La piedra recuerda posibilidades anteriores a ti.',
    stem: 'stem-ruin',
  },
  storm: {
    preview: ['crystal', 'spikes', 'uncertainty-nest'],
    narrative: 'También el peligro necesitaba una forma para existir.',
    stem: 'stem-storm',
  },
};

/** Persistent run progression. Death deliberately has no reset path here. */
export class ProgressionSystem {
  private readonly anchorByPack: ReadonlyMap<UnlockablePackId, CellId>;
  private readonly collected = new Set<UnlockablePackId>();
  private pauseRemainingSeconds = 0;
  private paletteEpoch = 0;

  constructor(
    macroPlan: MacroPlan,
    private readonly options: ProgressionOptions,
  ) {
    this.anchorByPack = new Map(
      macroPlan.anchors.map((anchor) => [anchor.packId, anchor.cellId]),
    );
  }

  update(deltaSeconds: number): ProgressionSnapshot {
    const remaining = Math.max(
      0,
      this.pauseRemainingSeconds - Math.max(0, deltaSeconds),
    );
    this.pauseRemainingSeconds = remaining <= 1e-9 ? 0 : remaining;
    return this.snapshot();
  }

  collectAt(cellId: CellId): SeedCollectionEvent | null {
    const nextPack = this.nextPack();
    if (
      nextPack === null ||
      this.collected.has(nextPack) ||
      this.anchorByPack.get(nextPack) !== cellId
    ) {
      return null;
    }

    this.collected.add(nextPack);
    this.paletteEpoch = this.options.unlockPack(nextPack);
    this.pauseRemainingSeconds = SEED_COLLECTION_PAUSE_SECONDS;
    const presentation = PACK_PRESENTATION[nextPack];
    const event: SeedCollectionEvent = {
      type: 'SEED_COLLECTED',
      packId: nextPack,
      cellId,
      paletteEpoch: this.paletteEpoch,
      pauseSeconds: SEED_COLLECTION_PAUSE_SECONDS,
      previewSilhouettes: presentation.preview,
      narrativeLine: presentation.narrative,
      musicStemId: presentation.stem,
    };
    this.options.onSeedCollected?.(event);
    return event;
  }

  notifyDeath(): ProgressionSnapshot {
    return this.snapshot();
  }

  isClockPaused(): boolean {
    return this.pauseRemainingSeconds > 0;
  }

  hasCollected(packId: UnlockablePackId): boolean {
    return this.collected.has(packId);
  }

  getSeedCell(packId: UnlockablePackId): CellId {
    const cellId = this.anchorByPack.get(packId);
    if (cellId === undefined) {
      throw new Error(`Macro plan is missing ${packId} seed anchor.`);
    }
    return cellId;
  }

  snapshot(): ProgressionSnapshot {
    const nextPack = this.nextPack();
    const packStates = Object.fromEntries(
      SEED_PACK_ORDER.map((packId) => [
        packId,
        this.collected.has(packId)
          ? 'COLLECTED'
          : packId === nextPack
            ? 'AVAILABLE'
            : 'LOCKED',
      ]),
    ) as Record<UnlockablePackId, PackProgressState>;
    return {
      collectedPacks: SEED_PACK_ORDER.filter((packId) =>
        this.collected.has(packId),
      ),
      nextPack,
      pauseRemainingSeconds: this.pauseRemainingSeconds,
      paletteEpoch: this.paletteEpoch,
      packStates,
    };
  }

  private nextPack(): UnlockablePackId | null {
    return (
      SEED_PACK_ORDER.find((packId) => !this.collected.has(packId)) ?? null
    );
  }
}
