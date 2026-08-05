import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  type BufferGeometry,
  type Material,
} from 'three';

export class InstancedFamily {
  readonly id: string;
  readonly mesh: InstancedMesh;
  readonly capacity: number;
  readonly #keys: (string | null)[];
  readonly #slots = new Map<string, number>();
  readonly #scratchMatrix = new Matrix4();
  #boundsDirty = false;

  constructor(
    id: string,
    geometry: BufferGeometry,
    material: Material,
    capacity: number,
  ) {
    if (id.length === 0) throw new Error('instance family id cannot be empty');
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('instance family capacity must be positive');
    }
    this.id = id;
    this.capacity = capacity;
    this.#keys = Array<string | null>(capacity).fill(null);
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.name = `instances:${id}`;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = true;
  }

  get count(): number {
    return this.mesh.count;
  }

  has(key: string): boolean {
    return this.#slots.has(key);
  }

  setInstance(key: string, matrix: Matrix4): number {
    if (key.length === 0) throw new Error('instance key cannot be empty');
    let slot = this.#slots.get(key);
    if (slot === undefined) {
      if (this.mesh.count >= this.capacity) {
        throw new RangeError(`instance family ${this.id} reached capacity`);
      }
      slot = this.mesh.count;
      this.mesh.count += 1;
      this.#slots.set(key, slot);
      this.#keys[slot] = key;
    }
    this.mesh.setMatrixAt(slot, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.#boundsDirty = true;
    return slot;
  }

  removeInstance(key: string): boolean {
    const slot = this.#slots.get(key);
    if (slot === undefined) return false;
    const lastSlot = this.mesh.count - 1;
    const lastKey = this.#keys[lastSlot];
    if (slot !== lastSlot && lastKey !== null && lastKey !== undefined) {
      this.mesh.getMatrixAt(lastSlot, this.#scratchMatrix);
      this.mesh.setMatrixAt(slot, this.#scratchMatrix);
      this.#slots.set(lastKey, slot);
      this.#keys[slot] = lastKey;
    }
    this.#slots.delete(key);
    this.#keys[lastSlot] = null;
    this.mesh.count = lastSlot;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.#boundsDirty = true;
    return true;
  }

  getMatrix(key: string, target: Matrix4): boolean {
    const slot = this.#slots.get(key);
    if (slot === undefined) return false;
    this.mesh.getMatrixAt(slot, target);
    return true;
  }

  clear(): void {
    this.#slots.clear();
    this.#keys.fill(null);
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.#boundsDirty = true;
  }

  /** Recomputes bounds once after a batch of matrix edits. */
  flush(): void {
    if (!this.#boundsDirty) return;
    this.mesh.computeBoundingBox();
    this.mesh.computeBoundingSphere();
    this.#boundsDirty = false;
  }

  /** The asset owner disposes shared geometry and material exactly once. */
  dispose(): void {
    this.clear();
    this.#boundsDirty = false;
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }
}

export class ObjectPool<T> {
  readonly #create: () => T;
  readonly #reset: (value: T) => void;
  readonly #available: T[] = [];
  #created = 0;

  constructor(create: () => T, reset: (value: T) => void) {
    this.#create = create;
    this.#reset = reset;
  }

  get createdCount(): number {
    return this.#created;
  }

  get availableCount(): number {
    return this.#available.length;
  }

  acquire(): T {
    const pooled = this.#available.pop();
    if (pooled !== undefined) return pooled;
    this.#created += 1;
    return this.#create();
  }

  release(value: T): void {
    this.#reset(value);
    this.#available.push(value);
  }
}
