import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Material,
  type Object3D,
  type Scene,
} from 'three';

import type { UnlockablePackId } from '../contracts/tiles';
import type { CellId } from '../contracts/world';
import type { MacroPlan } from '../gameplay/anchors';
import type { RespawnPhase } from '../gameplay/respawn';
import type { ProceduralTextureLibrary } from './textures';

const PACK_COLORS: Readonly<Record<UnlockablePackId, number>> = {
  water: 0x65d9ff,
  forest: 0x8fe397,
  ruin: 0xe0c28c,
  storm: 0xe98cff,
};

function positionOf(cellId: CellId): readonly [number, number] {
  const x = cellId % 64;
  const z = Math.floor(cellId / 64);
  return [(x + 0.5) * 2, (z + 0.5) * 2];
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials: Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export class Wp5PreviewVisuals {
  readonly root = new Group();

  private readonly seedGroups = new Map<UnlockablePackId, Group>();
  private readonly previews: { object: Object3D; age: number }[] = [];

  constructor(
    scene: Scene,
    plan: MacroPlan,
    _reducedFlashes = false,
    private readonly textures?: ProceduralTextureLibrary,
  ) {
    this.root.name = 'wp5-gated-preview';
    for (const anchor of plan.anchors) {
      const [x, z] = positionOf(anchor.cellId);
      const group = new Group();
      group.position.set(x, 0, z);
      group.userData.packId = anchor.packId;

      const beamMaterial = new MeshStandardMaterial({
        color: PACK_COLORS[anchor.packId],
        emissive: PACK_COLORS[anchor.packId],
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.24,
        map: this.textureForPack(anchor.packId),
      });
      const beam = new Mesh(new CylinderGeometry(0.1, 0.5, 9, 8), beamMaterial);
      beam.position.y = 4.5;
      const seed = new Mesh(
        new IcosahedronGeometry(0.48, 1),
        new MeshStandardMaterial({
          color: PACK_COLORS[anchor.packId],
          emissive: PACK_COLORS[anchor.packId],
          emissiveIntensity: 1.2,
          roughness: 0.28,
          map: this.textureForPack(anchor.packId),
        }),
      );
      seed.name = `seed-${anchor.packId}`;
      seed.position.y = 0.85;
      group.add(beam, seed);
      this.root.add(group);
      this.seedGroups.set(anchor.packId, group);
    }
    scene.add(this.root);
  }

  collectSeed(
    packId: UnlockablePackId,
    silhouettes: readonly [string, string, string],
  ): void {
    const group = this.seedGroups.get(packId);
    if (!group || !group.visible) return;
    group.visible = false;
    const x = group.position.x;
    const z = group.position.z;
    silhouettes.forEach((name, index) => {
      const preview = new Mesh(
        index === 0
          ? new ConeGeometry(0.32, 1.1, 5)
          : index === 1
            ? new BoxGeometry(0.65, 0.65, 0.65)
            : new SphereGeometry(0.36, 8, 6),
        new MeshStandardMaterial({
          color: PACK_COLORS[packId],
          emissive: PACK_COLORS[packId],
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.8,
          map: this.textureForPack(packId),
        }),
      );
      preview.name = `preview-${name}`;
      preview.position.set(x + (index - 1) * 1.1, 1.2, z);
      this.root.add(preview);
      this.previews.push({ object: preview, age: 0 });
    });
  }

  setRespawnPhase(phase: RespawnPhase): void {
    this.root.userData.respawnPhase = phase;
  }

  update(deltaSeconds: number, elapsedSeconds: number): void {
    for (const [packId, group] of this.seedGroups) {
      if (!group.visible) continue;
      const seed = group.getObjectByName(`seed-${packId}`);
      if (seed) {
        seed.rotation.y += deltaSeconds * 1.7;
        seed.position.y = 0.85 + Math.sin(elapsedSeconds * 2.4) * 0.12;
      }
    }
    for (let index = this.previews.length - 1; index >= 0; index -= 1) {
      const preview = this.previews[index]!;
      preview.age += deltaSeconds;
      preview.object.position.y += deltaSeconds * 0.55;
      preview.object.scale.setScalar(Math.max(0, 1 - preview.age / 1.5));
      if (preview.age >= 1.5) {
        this.root.remove(preview.object);
        disposeObject(preview.object);
        this.previews.splice(index, 1);
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeObject(this.root);
    this.seedGroups.clear();
    this.previews.length = 0;
  }

  private textureForPack(
    packId: UnlockablePackId,
  ): ProceduralTextureLibrary['meadow'] | null {
    if (!this.textures) return null;
    if (packId === 'water') return this.textures.water;
    if (packId === 'forest') return this.textures.foliage;
    if (packId === 'ruin') return this.textures.stone;
    return this.textures.hazard;
  }
}
