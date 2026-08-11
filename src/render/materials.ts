import { MeshStandardMaterial } from 'three';

import {
  createProceduralTextureLibrary,
  type ProceduralTextureLibrary,
} from './textures';

export interface StylizedMaterialLibrary {
  readonly meadow: MeshStandardMaterial;
  readonly foliage: MeshStandardMaterial;
  readonly stone: MeshStandardMaterial;
  readonly collapseGold: MeshStandardMaterial;
  readonly all: readonly MeshStandardMaterial[];
  readonly textures: ProceduralTextureLibrary;
  dispose(): void;
}

/** Shared PBR materials keep the fixed world tactile without per-instance clones. */
export function createStylizedMaterialLibrary(
  sharedTextures?: ProceduralTextureLibrary,
): StylizedMaterialLibrary {
  const textures = sharedTextures ?? createProceduralTextureLibrary();
  const meadow = new MeshStandardMaterial({
    name: 'fixed-meadow-shared',
    color: 0x4f8f62,
    roughness: 0.88,
    metalness: 0,
    map: textures.meadow,
  });
  const foliage = new MeshStandardMaterial({
    name: 'fixed-foliage-shared',
    color: 0x78aa63,
    roughness: 0.82,
    metalness: 0,
    map: textures.foliage,
  });
  const stone = new MeshStandardMaterial({
    name: 'fixed-stone-shared',
    color: 0x758287,
    roughness: 0.96,
    metalness: 0.02,
    map: textures.stone,
  });
  const collapseGold = new MeshStandardMaterial({
    name: 'collapse-gold-shared',
    color: 0xfff1c6,
    emissive: 0xffb84f,
    emissiveIntensity: 1.35,
    roughness: 0.32,
    metalness: 0.08,
    map: textures.hazard,
  });
  const all = [meadow, foliage, stone, collapseGold] as const;
  return {
    meadow,
    foliage,
    stone,
    collapseGold,
    all,
    textures,
    dispose: () => {
      all.forEach((material) => material.dispose());
      if (!sharedTextures) textures.dispose();
    },
  };
}
