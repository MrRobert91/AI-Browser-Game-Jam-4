import {
  ConeGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';

import { InstancedFamily } from './instancing';

export interface OriginDetailField {
  readonly family: InstancedFamily;
  dispose(): void;
}

/** A deterministic one-draw-call meadow detail field around the origin. */
export function createOriginDetailField(scene: Scene): OriginDetailField {
  const geometry = new ConeGeometry(0.035, 0.22, 3, 1);
  geometry.translate(0, 0.11, 0);
  const material = new MeshStandardMaterial({
    color: 0x78a67b,
    roughness: 0.95,
    metalness: 0,
  });
  const family = new InstancedFamily('origin-grass', geometry, material, 256);
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3(1, 1, 1);

  for (let index = 0; index < 256; index += 1) {
    const gridX = index % 16;
    const gridZ = Math.floor(index / 16);
    const jitterX = deterministicJitter(index, 0x45d9f3b);
    const jitterZ = deterministicJitter(index, 0x119de1f3);
    position.set(48.5 + gridX * 2 + jitterX, 0, 48.5 + gridZ * 2 + jitterZ);
    const height = 0.75 + deterministicUnit(index, 0x27d4eb2d) * 0.5;
    scale.set(1, height, 1);
    matrix.compose(position, rotation, scale);
    family.setInstance(`origin-detail:${index}`, matrix);
  }
  family.flush();
  family.mesh.receiveShadow = true;
  scene.add(family.mesh);

  return {
    family,
    dispose: () => {
      family.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

function deterministicJitter(index: number, salt: number): number {
  return (deterministicUnit(index, salt) - 0.5) * 1.2;
}

function deterministicUnit(index: number, salt: number): number {
  let value = Math.imul(index + 1, salt) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  return (value >>> 0) / 0x1_0000_0000;
}
