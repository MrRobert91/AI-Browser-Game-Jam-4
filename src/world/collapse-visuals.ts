import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';

import { GRAMMAR_SOURCE } from '../contracts/grammar-runtime';
import type { CollapseEvent } from '../contracts/messages';
import type { ProceduralTextureMaps } from '../contracts/render';
import type { CellId, WorldVector3 } from '../contracts/world';
import type { CollapseVisualAdapter } from './collapse-director';
import { WORLD_CELLS_PER_SIDE, type WorldState } from './world-state';

export type SliceFeatureKind =
  | 'empty'
  | 'tree'
  | 'flower'
  | 'rock'
  | 'shrub'
  | 'mushroom'
  | 'reeds'
  | 'structure'
  | 'bomb';

type VisibleFeatureKind = Exclude<SliceFeatureKind, 'empty'>;

export interface SliceTileStyle {
  readonly color: number;
  readonly deepWater: boolean;
  readonly feature: SliceFeatureKind;
  readonly featureTileId: number | null;
  readonly visualVariant: 0 | 1 | 2 | 3 | 4;
}

export const VISUAL_VARIANTS_PER_FAMILY = 5;
export const MAX_FIXED_WORLD_DRAW_BATCHES = 50;
const MAX_FIXED_WORLD_INSTANCES = WORLD_CELLS_PER_SIDE ** 2;
const FRACTURE_COLOR = 0x19141f;
const TERRAIN_BY_ID = new Map(
  GRAMMAR_SOURCE.terrain.map((definition) => [
    definition.numericId,
    definition,
  ]),
);
const FEATURE_BY_ID = new Map(
  GRAMMAR_SOURCE.features.map((definition) => [
    definition.numericId,
    definition,
  ]),
);

/** Stable visual-only variation; it never consumes a WFC domain bit. */
export function visualVariantIndex(
  worldSeed: number,
  cellId: CellId,
  tileId: number,
): 0 | 1 | 2 | 3 | 4 {
  let value =
    (worldSeed ^
      Math.imul(cellId + 1, 0x45d9f3b) ^
      Math.imul(tileId + 1, 0x27d4eb2d)) >>>
    0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  return (value % VISUAL_VARIANTS_PER_FAMILY) as 0 | 1 | 2 | 3 | 4;
}

export function classifySliceTile(event: CollapseEvent): SliceTileStyle {
  const terrain = TERRAIN_BY_ID.get(event.terrainTileId);
  const feature =
    event.featureTileId === null
      ? undefined
      : FEATURE_BY_ID.get(event.featureTileId);
  const terrainTags = terrain?.tags ?? [];
  const deepWater = terrainTags.includes('deep_water');
  let color = 0x568b56;
  if (deepWater) color = 0x1c607e;
  else if (terrainTags.includes('water') || terrainTags.includes('wet'))
    color = 0x3d91a0;
  else if (terrainTags.includes('forest')) color = 0x3f7044;
  else if (terrainTags.includes('ruin')) color = 0x817767;
  else if (terrainTags.includes('storm')) color = 0x52476d;
  else if (terrainTags.includes('stone')) color = 0x777b78;
  else if (terrainTags.includes('dry')) color = 0x8c744c;

  return {
    color,
    deepWater,
    feature: featureKind(feature?.tags ?? []),
    featureTileId: event.featureTileId,
    visualVariant: visualVariantIndex(
      event.worldSeed,
      event.cellId,
      event.featureTileId ?? event.terrainTileId,
    ),
  };
}

interface VisualRecord {
  readonly cellId: CellId;
  readonly group: Group;
  readonly terrainMaterial: MeshStandardMaterial;
  readonly transientMaterials: readonly MeshStandardMaterial[];
  readonly style: SliceTileStyle;
}

interface WaveRecord {
  readonly mesh: Mesh<RingGeometry, MeshStandardMaterial>;
  ageSeconds: number;
}

interface FixedBatch {
  readonly mesh: InstancedMesh;
  readonly material: MeshStandardMaterial;
  readonly instanceByCell: Map<CellId, number>;
}

interface FixedPlacement {
  readonly terrain: { readonly batch: FixedBatch; readonly index: number };
  readonly feature?: { readonly batch: FixedBatch; readonly index: number };
}

function featureKind(tags: readonly string[]): SliceFeatureKind {
  if (tags.includes('consciousness_bomb')) return 'bomb';
  if (tags.includes('tree')) return 'tree';
  if (tags.includes('mushrooms')) return 'mushroom';
  if (tags.includes('reeds') || tags.includes('mirror_reed')) return 'reeds';
  if (tags.includes('flowers') || tags.includes('bell_flower')) return 'flower';
  if (
    tags.includes('rock') ||
    tags.includes('crystal') ||
    tags.includes('memory_stone')
  )
    return 'rock';
  if (tags.includes('shrub')) return 'shrub';
  if (
    tags.some((tag) =>
      ['arch', 'column', 'wall', 'statue', 'monolith'].includes(tag),
    )
  )
    return 'structure';
  return 'empty';
}

function featureHeight(kind: VisibleFeatureKind, _variant: number): number {
  if (kind === 'tree') return 0;
  if (kind === 'structure') return 0;
  if (kind === 'bomb') return 0.72;
  if (kind === 'rock') return 0;
  return 0;
}

function featureColor(kind: VisibleFeatureKind): number {
  if (kind === 'tree' || kind === 'shrub' || kind === 'reeds') return 0x5d9856;
  if (kind === 'flower') return 0xe88aa8;
  if (kind === 'mushroom') return 0xd8a06c;
  if (kind === 'structure') return 0x958a76;
  if (kind === 'bomb') return 0xb10f1d;
  return 0x737b7d;
}

function featureGeometry(
  kind: VisibleFeatureKind,
  variant: number,
): BufferGeometry {
  const scale = 1 + (variant - 2) * 0.08;
  switch (kind) {
    case 'tree':
      return treeGeometry(variant);
    case 'rock': {
      const pieces = Array.from({ length: 2 + (variant % 3) }, (_, index) => {
        const geometry = new IcosahedronGeometry(0.58 + index * 0.08, 0);
        geometry.scale(
          1.18 + variant * 0.035,
          0.72 + variant * 0.09,
          1.08 + (4 - variant) * 0.03,
        );
        geometry.translate(
          (index - 1) * 0.34,
          0.52 + index * 0.12,
          (index % 2) * 0.28 - 0.14,
        );
        return geometry;
      });
      return mergeGeometries(pieces);
    }
    case 'shrub': {
      const geometry = new SphereGeometry(0.82 * scale, 5 + variant, 4);
      geometry.scale(1.15, 0.62 + variant * 0.04, 0.95);
      geometry.translate(0, 0.56, 0);
      return geometry;
    }
    case 'flower':
      return clusteredDetailGeometry('flower', variant);
    case 'mushroom':
      return clusteredDetailGeometry('mushroom', variant);
    case 'reeds':
      return clusteredDetailGeometry('reeds', variant);
    case 'structure':
      return ruinGeometry(variant);
    case 'bomb':
      return bombGeometry(variant);
  }
}

function mergeGeometries(parts: readonly BufferGeometry[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const part of parts) {
    const geometry = part.index ? part.toNonIndexed() : part;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    for (let index = 0; index < position.count; index += 1) {
      positions.push(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      );
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
    }
    if (geometry !== part) geometry.dispose();
    part.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function treeGeometry(variant: number): BufferGeometry {
  const height = 4.64 + variant * 0.28;
  const trunkHeight = height * (0.58 + (variant % 2) * 0.03);
  const crownRadius = 0.9 + variant * 0.0625;
  const trunk = new CylinderGeometry(
    0.16 + variant * 0.018,
    0.25 + variant * 0.025,
    trunkHeight,
    6 + variant,
  );
  trunk.translate(0, trunkHeight / 2, 0);
  const crowns = Array.from({ length: 3 + (variant % 3) }, (_, index) => {
    const crown =
      index % 2 === 0
        ? new SphereGeometry(
            crownRadius * (0.92 - index * 0.05),
            7 + variant,
            5,
          )
        : new ConeGeometry(crownRadius, 1.9 + variant * 0.12, 7 + variant);
    crown.scale(1, 0.8 + (index % 2) * 0.25, 1);
    const angle = (index / (3 + (variant % 3))) * Math.PI * 2 + variant * 0.31;
    crown.translate(
      Math.cos(angle) * 0.28,
      height - crownRadius - index * 0.48,
      Math.sin(angle) * 0.28,
    );
    return crown;
  });
  return mergeGeometries([trunk, ...crowns]);
}

function ruinGeometry(variant: number): BufferGeometry {
  const height = 3.5 + variant * 0.625;
  const width = 1.7 + variant * 0.0625;
  const parts: BufferGeometry[] = [];
  if (variant === 0) {
    for (const x of [-0.65, 0.65]) {
      const pillar = new BoxGeometry(0.42, height, 0.58);
      pillar.translate(x, height / 2, 0);
      parts.push(pillar);
    }
    const lintel = new BoxGeometry(width, 0.48, 0.65);
    lintel.translate(0, height - 0.24, 0);
    parts.push(lintel);
  } else if (variant === 1) {
    const column = new CylinderGeometry(0.56, 0.7, height, 7);
    column.translate(0, height / 2, 0);
    parts.push(column);
  } else if (variant === 2) {
    const wall = new BoxGeometry(width, height, 0.65);
    wall.rotateY(0.12);
    wall.translate(0, height / 2, 0);
    parts.push(wall);
  } else if (variant === 3) {
    for (const z of [-0.55, 0.55]) {
      const slab = new BoxGeometry(width, height * 0.82, 0.45);
      slab.rotateY(z > 0 ? 0.16 : -0.16);
      slab.translate(0, height * 0.41, z);
      parts.push(slab);
    }
  } else {
    const statue = new CylinderGeometry(0.48, 0.7, height * 0.82, 6);
    statue.translate(0, height * 0.41, 0);
    const head = new IcosahedronGeometry(0.58, 0);
    head.translate(0, height - 0.36, 0);
    parts.push(statue, head);
  }
  return mergeGeometries(parts);
}

function clusteredDetailGeometry(
  kind: 'flower' | 'mushroom' | 'reeds',
  variant: number,
): BufferGeometry {
  const count = 7 + variant;
  const parts = Array.from({ length: count }, (_, index) => {
    const height =
      kind === 'reeds' ? 1.1 + (index % 4) * 0.13 : 0.55 + (index % 3) * 0.08;
    const part =
      kind === 'mushroom'
        ? new SphereGeometry(0.2 + (index % 2) * 0.04, 5, 4)
        : kind === 'reeds'
          ? new CylinderGeometry(0.05, 0.07, height, 4)
          : new ConeGeometry(0.16, height, 5 + (variant % 3));
    const angle = index * 2.399 + variant;
    const radius = 0.25 + (index / count) * 0.65;
    part.translate(
      Math.cos(angle) * radius,
      kind === 'mushroom' ? height * 0.55 : height / 2,
      Math.sin(angle) * radius,
    );
    return part;
  });
  return mergeGeometries(parts);
}

function bombGeometry(variant: number): BufferGeometry {
  const core = new IcosahedronGeometry(0.68 + variant * 0.015, 1);
  core.translate(0, 0.72, 0);
  const spikes: BufferGeometry[] = [];
  const count = 10 + variant;
  for (let index = 0; index < count; index += 1) {
    const phi = Math.acos(1 - (2 * (index + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    const direction = new Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    const spike = new ConeGeometry(0.13, 0.65 + (index % 3) * 0.08, 5);
    spike.applyQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction),
    );
    spike.translate(
      direction.x * 0.95,
      0.72 + direction.y * 0.95,
      direction.z * 0.95,
    );
    spikes.push(spike);
  }
  return mergeGeometries([core, ...spikes]);
}

/** Fixed commits are batched by terrain family and visual-only feature variation. */
export class SliceCollapseVisuals implements CollapseVisualAdapter {
  readonly root = new Group();

  private readonly records = new Map<CellId, VisualRecord>();
  private readonly placements = new Map<CellId, FixedPlacement>();
  private readonly waves: WaveRecord[] = [];
  private readonly deepWaterCells = new Set<CellId>();
  private readonly terrainBatches = new Map<number, FixedBatch>();
  private readonly featureBatches = new Map<string, FixedBatch>();
  private readonly terrainGeometry = new BoxGeometry(1.94, 0.14, 1.94);
  private readonly waveGeometry = new RingGeometry(0.7, 0.77, 24);
  private readonly matrix = new Matrix4();

  constructor(
    scene: Scene,
    _worldState: WorldState,
    private readonly textures?: ProceduralTextureMaps,
  ) {
    this.root.name = 'fixed-observed-world';
    scene.add(this.root);
  }

  begin(event: CollapseEvent, center: WorldVector3): void {
    if (this.records.has(event.cellId)) return;
    const style = classifySliceTile(event);
    if (style.deepWater) this.deepWaterCells.add(event.cellId);
    const group = new Group();
    group.position.set(center[0], 0, center[2]);
    group.rotation.y = event.terrainRotationQuarterTurns * (Math.PI / 2);
    group.scale.setScalar(0.85);
    const terrainMaterial = new MeshStandardMaterial({
      color: style.color,
      emissive: 0xffc45c,
      emissiveIntensity: 1.15,
      roughness: style.deepWater ? 0.24 : 0.92,
      metalness: style.deepWater ? 0.16 : 0,
      transparent: true,
      opacity: 0,
      map: style.deepWater
        ? (this.textures?.water ?? null)
        : (this.textures?.meadow ?? null),
    });
    const terrain = new Mesh(this.terrainGeometry, terrainMaterial);
    terrain.position.y = style.deepWater ? -0.04 : 0.05;
    terrain.receiveShadow = true;
    group.add(terrain);

    const transientMaterials: MeshStandardMaterial[] = [terrainMaterial];
    if (style.feature !== 'empty') {
      const material = this.createFeatureMaterial(style.feature);
      const feature = new Mesh(
        featureGeometry(style.feature, style.visualVariant),
        material,
      );
      feature.position.y = featureHeight(style.feature, style.visualVariant);
      if (style.feature === 'tree' && style.featureTileId === 9)
        feature.scale.set(1.1, 1.25, 1.1);
      feature.castShadow = true;
      group.add(feature);
      transientMaterials.push(material);
    }
    this.root.add(group);
    this.records.set(event.cellId, {
      cellId: event.cellId,
      group,
      terrainMaterial,
      transientMaterials,
      style,
    });
  }

  update(cellId: CellId, progress: number): void {
    const record = this.records.get(cellId);
    if (!record) return;
    const eased = 1 - Math.pow(1 - progress, 3);
    record.group.scale.setScalar(0.85 + eased * 0.15);
    record.terrainMaterial.opacity = eased;
    record.terrainMaterial.emissiveIntensity = (1 - eased) * 1.15;
  }

  emitBoundaryWave(cellId: CellId): void {
    const record = this.records.get(cellId);
    if (!record) return;
    const material = new MeshStandardMaterial({
      color: new Color(0xffe7a6),
      emissive: new Color(0x5a3c0d),
      transparent: true,
      opacity: 0.75,
      side: 2,
    });
    const mesh = new Mesh(this.waveGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(record.group.position);
    mesh.position.y = 0.12;
    this.root.add(mesh);
    this.waves.push({ mesh, ageSeconds: 0 });
  }

  complete(cellId: CellId): void {
    const record = this.records.get(cellId);
    if (!record) return;
    const terrain = this.addTerrainInstance(record);
    const feature =
      record.style.feature === 'empty'
        ? undefined
        : this.addFeatureInstance(record, record.style.feature);
    this.placements.set(
      cellId,
      feature === undefined ? { terrain } : { terrain, feature },
    );
    record.group.traverse((object) => {
      if (object instanceof Mesh && object.geometry !== this.terrainGeometry)
        object.geometry.dispose();
    });
    record.group.removeFromParent();
    for (const material of record.transientMaterials) material.dispose();
    record.group.clear();
    this.records.delete(cellId);
  }

  fracture(cellIds: readonly CellId[]): void {
    for (const cellId of cellIds) {
      const placement = this.placements.get(cellId);
      if (!placement) continue;
      this.hideInstance(placement.terrain.batch, placement.terrain.index);
      if (placement.feature)
        this.hideInstance(placement.feature.batch, placement.feature.index);
      this.deepWaterCells.delete(cellId);
      const center = [
        ((cellId % WORLD_CELLS_PER_SIDE) + 0.5) * 2,
        0,
        (Math.floor(cellId / WORLD_CELLS_PER_SIDE) + 0.5) * 2,
      ] as const;
      const batch = this.getTerrainBatch(FRACTURE_COLOR, false);
      this.matrix.makeTranslation(center[0], 0.035, center[2]);
      const index = batch.mesh.count;
      batch.mesh.setMatrixAt(index, this.matrix);
      batch.mesh.count += 1;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.instanceByCell.set(cellId, index);
      this.placements.set(cellId, { terrain: { batch, index } });
    }
  }

  updateFrame(deltaSeconds: number): void {
    for (let index = this.waves.length - 1; index >= 0; index -= 1) {
      const wave = this.waves[index]!;
      wave.ageSeconds += deltaSeconds;
      wave.mesh.scale.setScalar(1 + wave.ageSeconds * 3.2);
      wave.mesh.material.opacity = Math.max(0, 0.75 - wave.ageSeconds * 1.5);
      if (wave.ageSeconds >= 0.5) {
        this.root.remove(wave.mesh);
        wave.mesh.material.dispose();
        this.waves.splice(index, 1);
      }
    }
  }

  isDeepWater(cellId: CellId): boolean {
    return this.deepWaterCells.has(cellId);
  }

  setEndingMode(enabled: boolean): void {
    const emissive = enabled ? 0x102318 : 0x000000;
    for (const batch of this.terrainBatches.values())
      batch.material.emissive.set(emissive);
    for (const record of this.records.values())
      record.terrainMaterial.emissive.set(emissive);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    this.terrainGeometry.dispose();
    this.waveGeometry.dispose();
    this.records.clear();
    this.placements.clear();
    this.waves.length = 0;
    this.deepWaterCells.clear();
    this.terrainBatches.clear();
    this.featureBatches.clear();
    this.root.clear();
  }

  private addTerrainInstance(record: VisualRecord): {
    readonly batch: FixedBatch;
    readonly index: number;
  } {
    const batch = this.getTerrainBatch(
      record.style.color,
      record.style.deepWater,
    );
    this.matrix.makeTranslation(
      record.group.position.x,
      record.style.deepWater ? -0.04 : 0.05,
      record.group.position.z,
    );
    const index = batch.mesh.count;
    batch.mesh.setMatrixAt(index, this.matrix);
    batch.mesh.count += 1;
    batch.mesh.instanceMatrix.needsUpdate = true;
    batch.instanceByCell.set(record.cellId, index);
    return { batch, index };
  }

  private getTerrainBatch(color: number, deepWater: boolean): FixedBatch {
    let batch = this.terrainBatches.get(color);
    if (!batch) {
      const material = new MeshStandardMaterial({
        color,
        roughness: deepWater ? 0.24 : 0.92,
        metalness: deepWater ? 0.16 : 0,
        map: deepWater
          ? (this.textures?.water ?? null)
          : color === FRACTURE_COLOR
            ? (this.textures?.stone ?? null)
            : (this.textures?.meadow ?? null),
      });
      const mesh = new InstancedMesh(
        this.terrainGeometry,
        material,
        MAX_FIXED_WORLD_INSTANCES,
      );
      mesh.name = `fixed-terrain-${color.toString(16)}`;
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      batch = { mesh, material, instanceByCell: new Map() };
      this.terrainBatches.set(color, batch);
      this.root.add(mesh);
    }
    return batch;
  }

  private addFeatureInstance(
    record: VisualRecord,
    kind: VisibleFeatureKind,
  ): { readonly batch: FixedBatch; readonly index: number } {
    const key = `${kind}:${record.style.visualVariant}`;
    let batch = this.featureBatches.get(key);
    if (!batch) {
      const material = this.createFeatureMaterial(kind);
      const mesh = new InstancedMesh(
        featureGeometry(kind, record.style.visualVariant),
        material,
        MAX_FIXED_WORLD_INSTANCES,
      );
      mesh.name = `fixed-feature-${key}`;
      mesh.count = 0;
      mesh.castShadow =
        kind === 'tree' || kind === 'structure' || kind === 'bomb';
      mesh.frustumCulled = false;
      batch = { mesh, material, instanceByCell: new Map() };
      this.featureBatches.set(key, batch);
      this.root.add(mesh);
    }
    this.matrix.compose(
      record.group.position
        .clone()
        .setY(featureHeight(kind, record.style.visualVariant)),
      record.group.quaternion,
      record.style.feature === 'tree' && record.style.featureTileId === 9
        ? record.group.scale.clone().set(1.1, 1.25, 1.1)
        : record.group.scale.clone().set(1, 1, 1),
    );
    const index = batch.mesh.count;
    batch.mesh.setMatrixAt(index, this.matrix);
    batch.mesh.count += 1;
    batch.mesh.instanceMatrix.needsUpdate = true;
    batch.instanceByCell.set(record.cellId, index);
    return { batch, index };
  }

  private hideInstance(batch: FixedBatch, index: number): void {
    this.matrix.makeScale(0, 0, 0);
    batch.mesh.setMatrixAt(index, this.matrix);
    batch.mesh.instanceMatrix.needsUpdate = true;
  }

  private createFeatureMaterial(
    kind: VisibleFeatureKind,
  ): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: featureColor(kind),
      roughness: kind === 'flower' ? 0.72 : kind === 'bomb' ? 0.48 : 0.9,
      metalness: kind === 'bomb' ? 0.32 : 0,
      emissive:
        kind === 'flower' ? 0x35101f : kind === 'bomb' ? 0x5d0008 : 0x000000,
      emissiveIntensity: kind === 'bomb' ? 1.1 : 1,
      map: this.featureTexture(kind),
    });
  }

  private featureTexture(
    kind: VisibleFeatureKind,
  ): ProceduralTextureMaps[keyof ProceduralTextureMaps] | null {
    if (!this.textures) return null;
    if (kind === 'tree' || kind === 'shrub' || kind === 'reeds')
      return this.textures.foliage;
    if (kind === 'flower' || kind === 'mushroom') return this.textures.flower;
    if (kind === 'bomb') return this.textures.hazard;
    return this.textures.stone;
  }
}
