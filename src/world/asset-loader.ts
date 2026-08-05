import { Mesh, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

interface CachedAsset {
  readonly promise: Promise<GLTF>;
  references: number;
}

export interface AssetLease {
  readonly asset: GLTF;
  release(): void;
}

/** Reference-counted local GLB cache; no remote or data URLs are accepted. */
export class LocalGltfAssetStore {
  readonly #loader: GLTFLoader;
  readonly #cache = new Map<string, CachedAsset>();

  constructor(loader = new GLTFLoader()) {
    this.#loader = loader;
  }

  get cachedAssetCount(): number {
    return this.#cache.size;
  }

  async acquire(path: string): Promise<AssetLease> {
    assertLocalAssetPath(path);
    let cached = this.#cache.get(path);
    if (cached === undefined) {
      cached = { promise: this.#loader.loadAsync(path), references: 0 };
      this.#cache.set(path, cached);
      void cached.promise.catch(() => this.#cache.delete(path));
    }
    cached.references += 1;
    const asset = await cached.promise;
    let released = false;
    return {
      asset,
      release: () => {
        if (released) return;
        released = true;
        const current = this.#cache.get(path);
        if (current === undefined) return;
        current.references -= 1;
        if (current.references === 0) {
          this.#cache.delete(path);
          disposeObjectResources(asset.scene);
        }
      },
    };
  }
}

export function assertLocalAssetPath(path: string): void {
  if (
    path.length === 0 ||
    path.includes('\\') ||
    path.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/iu.test(path) ||
    !(path.startsWith('/') || path.startsWith('./') || path.startsWith('../'))
  ) {
    throw new Error(`asset path must be local: ${path}`);
  }
}

function disposeObjectResources(root: Object3D): void {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of meshMaterials) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  const textures = new Set<Texture>();
  for (const material of materials) disposeMaterial(material, textures);
  for (const texture of textures) texture.dispose();
}

function disposeMaterial(material: Material, textures: Set<Texture>): void {
  for (const value of Object.values(material)) {
    if (isTexture(value)) textures.add(value);
  }
  material.dispose();
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isTexture' in value &&
    value.isTexture === true
  );
}
