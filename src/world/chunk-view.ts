import { Group, type Object3D } from 'three';

import type { WorldCellSnapshot } from './world-state';
import { WorldState } from './world-state';

export type ChunkCellVisualFactory = (
  cell: WorldCellSnapshot,
) => Object3D | null;

/**
 * A disposable visual projection over persistent logical world state.
 * Releasing this view never discards tile identity or rotation.
 */
export class ChunkView {
  readonly root = new Group();

  private hydrated = false;

  constructor(
    readonly chunkX: number,
    readonly chunkZ: number,
    private readonly worldState: WorldState,
  ) {
    this.root.name = `chunk-${chunkX}-${chunkZ}`;
  }

  rebuild(factory: ChunkCellVisualFactory): void {
    this.releaseVisuals();
    for (const cell of this.worldState.getChunkCells(this.chunkX, this.chunkZ)) {
      const visual = factory(cell);
      if (visual) {
        visual.userData.cellId = cell.cellId;
        this.root.add(visual);
      }
    }
    this.hydrated = true;
  }

  releaseVisuals(): void {
    this.root.removeFromParent();
    this.root.clear();
    this.hydrated = false;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  snapshot(): readonly WorldCellSnapshot[] {
    return this.worldState.getChunkCells(this.chunkX, this.chunkZ);
  }
}
