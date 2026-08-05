import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from 'three';

import { assertLocalAssetPath } from '../../src/world/asset-loader';
import { InstancedFamily, ObjectPool } from '../../src/world/instancing';
import {
  MAX_VISIBLE_PROXIES,
  VisualChunkStreamer,
  selectVisibleProxies,
} from '../../src/world/visual-streaming';

describe('instanced families', () => {
  it('keeps 1,000 transforms in one mesh with shared resources', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial();
    const family = new InstancedFamily('meadow', geometry, material, 1_000);
    const beforeVersion = family.mesh.instanceMatrix.version;

    for (let index = 0; index < 1_000; index += 1) {
      family.setInstance(
        `cell:${index}`,
        new Matrix4().makeTranslation(index % 64, 0, Math.floor(index / 64)),
      );
    }
    family.flush();

    expect(family.count).toBe(1_000);
    expect(family.mesh.geometry).toBe(geometry);
    expect(family.mesh.material).toBe(material);
    expect(family.mesh.instanceMatrix.version).toBeGreaterThan(beforeVersion);
    expect(() => family.setInstance('overflow', new Matrix4())).toThrow(
      /capacity/,
    );
    family.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('compacts slots after removal and preserves the moved matrix', () => {
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    const family = new InstancedFamily('stone', geometry, material, 3);
    family.setInstance('a', new Matrix4().makeTranslation(1, 0, 0));
    family.setInstance('b', new Matrix4().makeTranslation(2, 0, 0));
    family.setInstance('c', new Matrix4().makeTranslation(3, 0, 0));
    expect(family.removeInstance('b')).toBe(true);

    const matrix = new Matrix4();
    const position = new Vector3();
    expect(family.getMatrix('c', matrix)).toBe(true);
    position.setFromMatrixPosition(matrix);
    expect(position.x).toBe(3);
    expect(family.count).toBe(2);
    family.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('reuses pooled objects instead of allocating again', () => {
    const pool = new ObjectPool(
      () => ({ value: 0 }),
      (value) => {
        value.value = 0;
      },
    );
    const first = pool.acquire();
    first.value = 9;
    pool.release(first);
    const second = pool.acquire();
    expect(second).toBe(first);
    expect(second.value).toBe(0);
    expect(pool.createdCount).toBe(1);
  });
});

describe('visual streaming and assets', () => {
  it('releases a distant visual without mutating logical state', () => {
    const scene = new Scene();
    const logical = { fixedCells: 37 };
    const disposeRoot = vi.fn();
    const streamer = new VisualChunkStreamer(scene);
    streamer.mount({
      chunkId: 3,
      bounds: { minX: 0, maxX: 32, minZ: 0, maxZ: 32 },
      logicalState: logical,
      createRoot: () => new Group(),
      disposeRoot,
    });

    expect(streamer.releaseBeyond(100, 100)).toEqual([3]);
    expect(streamer.mountedCount).toBe(0);
    expect(logical.fixedCells).toBe(37);
    expect(disposeRoot).toHaveBeenCalledTimes(1);
  });

  it('caps superposition proxies at 120 with stable priority ordering', () => {
    const selected = selectVisibleProxies(
      Array.from({ length: 200 }, (_, index) => ({
        id: `proxy:${index.toString().padStart(3, '0')}`,
        distance: 200 - index,
        priority: index % 3,
      })),
    );
    expect(selected).toHaveLength(MAX_VISIBLE_PROXIES);
    expect(selected[0]?.priority).toBe(2);
  });

  it('accepts only local GLB paths', () => {
    expect(() =>
      assertLocalAssetPath('/assets/tiles/meadow.glb'),
    ).not.toThrow();
    expect(() => assertLocalAssetPath('./assets/tree.glb')).not.toThrow();
    expect(() => assertLocalAssetPath('https://example.com/tree.glb')).toThrow(
      /local/,
    );
    expect(() => assertLocalAssetPath('//cdn.example/tree.glb')).toThrow(
      /local/,
    );
    expect(() =>
      assertLocalAssetPath('data:model/gltf-binary;base64,AAA'),
    ).toThrow(/local/);
  });
});
