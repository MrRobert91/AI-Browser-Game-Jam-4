import type { Group, Scene } from 'three';

export const VISUAL_STREAMING_DISTANCE_METERS = 42;
export const MAX_VISIBLE_PROXIES = 120;

export interface ChunkVisualBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface ChunkVisualDescriptor<TLogicalState> {
  readonly chunkId: number;
  readonly bounds: ChunkVisualBounds;
  readonly logicalState: TLogicalState;
  readonly createRoot: () => Group;
  readonly disposeRoot?: (root: Group) => void;
}

interface MountedChunk<
  TLogicalState,
> extends ChunkVisualDescriptor<TLogicalState> {
  readonly root: Group;
}

/** Owns disposable views only; logicalState is retained by the caller. */
export class VisualChunkStreamer<TLogicalState> {
  readonly #scene: Scene;
  readonly #mounted = new Map<number, MountedChunk<TLogicalState>>();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  get mountedCount(): number {
    return this.#mounted.size;
  }

  mount(descriptor: ChunkVisualDescriptor<TLogicalState>): Group {
    const existing = this.#mounted.get(descriptor.chunkId);
    if (existing !== undefined) return existing.root;
    const root = descriptor.createRoot();
    root.name = `chunk-view:${descriptor.chunkId}`;
    this.#scene.add(root);
    this.#mounted.set(descriptor.chunkId, { ...descriptor, root });
    return root;
  }

  releaseBeyond(
    playerX: number,
    playerZ: number,
    distance = VISUAL_STREAMING_DISTANCE_METERS,
  ): readonly number[] {
    if (!Number.isFinite(distance) || distance < 0) {
      throw new RangeError('visual streaming distance must be non-negative');
    }
    const released: number[] = [];
    for (const [chunkId, chunk] of this.#mounted) {
      if (distanceToBounds(playerX, playerZ, chunk.bounds) <= distance)
        continue;
      chunk.root.removeFromParent();
      chunk.disposeRoot?.(chunk.root);
      this.#mounted.delete(chunkId);
      released.push(chunkId);
    }
    return released;
  }

  dispose(): void {
    for (const chunk of this.#mounted.values()) {
      chunk.root.removeFromParent();
      chunk.disposeRoot?.(chunk.root);
    }
    this.#mounted.clear();
  }
}

export interface ProxyCandidate {
  readonly id: string;
  readonly distance: number;
  readonly priority?: number;
}

export function selectVisibleProxies(
  candidates: readonly ProxyCandidate[],
  limit = MAX_VISIBLE_PROXIES,
): readonly ProxyCandidate[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > MAX_VISIBLE_PROXIES) {
    throw new RangeError(
      `proxy limit must be between 0 and ${MAX_VISIBLE_PROXIES}`,
    );
  }
  return [...candidates]
    .sort(
      (left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) ||
        left.distance - right.distance ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

function distanceToBounds(
  x: number,
  z: number,
  bounds: ChunkVisualBounds,
): number {
  const closestX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
  const closestZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, z));
  return Math.hypot(x - closestX, z - closestZ);
}
