import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';

import type { QualityProfile } from './quality';
import type { StylizedMaterialLibrary } from './materials';

export const MAX_PROCEDURAL_VEGETATION_INSTANCES = 160;

function hash01(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

export function vegetationCountForQuality(profile: QualityProfile): number {
  if (profile.preset === 'low') return 48;
  if (profile.preset === 'medium') return 104;
  return MAX_PROCEDURAL_VEGETATION_INSTANCES;
}

/** Deterministic instanced detail: render quality changes density, never world state. */
export class ProceduralVegetationField {
  readonly root = new Group();
  readonly tufts: InstancedMesh;

  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();

  constructor(
    scene: Scene,
    materials: StylizedMaterialLibrary,
    profile: QualityProfile,
  ) {
    this.root.name = 'procedural-vegetation-field';
    const geometry = new BoxGeometry(0.055, 0.7, 0.055);
    geometry.translate(0, 0.35, 0);
    this.tufts = new InstancedMesh(
      geometry,
      materials.foliage,
      MAX_PROCEDURAL_VEGETATION_INSTANCES,
    );
    this.tufts.name = 'shared-foliage-lod0';
    this.tufts.userData.lod = profile.aggressiveLod ? 'aggressive' : 'standard';
    this.tufts.castShadow = profile.shadows;
    this.tufts.receiveShadow = false;
    this.root.add(this.tufts);
    scene.add(this.root);
    this.populate();
    this.applyQuality(profile);
  }

  applyQuality(profile: QualityProfile): void {
    this.tufts.count = vegetationCountForQuality(profile);
    this.tufts.castShadow = profile.shadows && profile.preset === 'high';
    this.tufts.userData.lod = profile.aggressiveLod ? 'aggressive' : 'standard';
  }

  update(elapsedSeconds: number): void {
    this.root.rotation.y = Math.sin(elapsedSeconds * 0.13) * 0.0025;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.tufts.geometry.dispose();
  }

  private populate(): void {
    for (
      let index = 0;
      index < MAX_PROCEDURAL_VEGETATION_INSTANCES;
      index += 1
    ) {
      const angle = hash01(index, 0x51f15e) * Math.PI * 2;
      const radius = 5 + Math.sqrt(hash01(index, 0x93a4d1)) * 35;
      this.position.set(
        64 + Math.cos(angle) * radius,
        0.08,
        64 + Math.sin(angle) * radius,
      );
      this.rotation.setFromAxisAngle(
        new Vector3(0, 1, 0),
        hash01(index, 0xc09d2f) * Math.PI,
      );
      const height = 0.5 + hash01(index, 0x77a155) * 0.85;
      this.scale.set(0.8, height, 0.8);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.tufts.setMatrixAt(index, this.matrix);
    }
    this.tufts.instanceMatrix.needsUpdate = true;
  }
}
