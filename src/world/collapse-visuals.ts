import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  type BufferGeometry,
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

function featureHeight(kind: VisibleFeatureKind, variant: number): number {
  if (kind === 'tree') return 1.35 + variant * 0.08;
  if (kind === 'structure') return 0.95;
  if (kind === 'bomb') return 0.72;
  if (kind === 'rock') return 0.55 + variant * 0.035;
  return 0.25 + variant * 0.025;
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
      return new ConeGeometry(0.58 * scale, 2.5 + variant * 0.12, 5 + variant);
    case 'rock': {
      const geometry = new IcosahedronGeometry(0.65, variant > 2 ? 1 : 0);
      geometry.scale(
        1 + variant * 0.0625,
        0.72 + variant * 0.055,
        1 + (4 - variant) * 0.04,
      );
      return geometry;
    }
    case 'shrub': {
      const geometry = new SphereGeometry(0.65 * scale, 5 + variant, 4);
      geometry.scale(1.15, 0.62 + variant * 0.04, 0.95);
      return geometry;
    }
    case 'flower':
      return new ConeGeometry(
        0.2 + variant * 0.025,
        0.48 + variant * 0.035,
        5 + variant,
      );
    case 'mushroom':
      return new SphereGeometry(0.28 + variant * 0.035, 6 + variant, 4);
    case 'reeds':
      return new CylinderGeometry(
        0.08,
        0.11,
        1.05 + variant * 0.12,
        4 + (variant % 2),
      );
    case 'structure':
      return new BoxGeometry(
        0.75 + variant * 0.08,
        1.9 + variant * 0.16,
        0.48 + (4 - variant) * 0.04,
      );
    case 'bomb':
      return new IcosahedronGeometry(0.72, 1);
  }
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
      record.group.scale.clone().set(1, 1, 1),
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
