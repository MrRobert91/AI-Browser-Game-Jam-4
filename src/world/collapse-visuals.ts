import {
  BoxGeometry,
  Color,
  ConeGeometry,
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

import type { CollapseEvent } from '../contracts/messages';
import type { ProceduralTextureMaps } from '../contracts/render';
import type { CellId, WorldVector3 } from '../contracts/world';
import type { CollapseVisualAdapter } from './collapse-director';
import { WORLD_CELLS_PER_SIDE, type WorldState } from './world-state';

export type SliceFeatureKind = 'empty' | 'tree' | 'flower' | 'rock';

export interface SliceTileStyle {
  readonly color: number;
  readonly deepWater: boolean;
  readonly feature: SliceFeatureKind;
}

export const MAX_FIXED_WORLD_DRAW_BATCHES = 7;
const MAX_FIXED_WORLD_INSTANCES = WORLD_CELLS_PER_SIDE ** 2;

export function classifySliceTile(
  cellId: CellId,
  paletteEpoch: number,
): SliceTileStyle {
  const hash = Math.imul(cellId ^ 0xa91f42c0, 0x45d9f3b) >>> 0;
  const deepWater = paletteEpoch > 0 && hash % 5 === 0;
  if (deepWater) {
    return { color: 0x247d9b, deepWater: true, feature: 'empty' };
  }
  const feature = (['empty', 'tree', 'flower', 'rock'] as const)[hash % 4]!;
  const palette = [0x4d8a62, 0x6aa05e, 0x89774f] as const;
  return { color: palette[hash % palette.length]!, deepWater: false, feature };
}

interface VisualRecord {
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
}

function featureHeight(kind: Exclude<SliceFeatureKind, 'empty'>): number {
  return kind === 'tree' ? 1.2 : 0.28;
}

function featureColor(kind: Exclude<SliceFeatureKind, 'empty'>): number {
  if (kind === 'tree') return 0x71a96d;
  if (kind === 'flower') return 0xff9ecf;
  return 0x798387;
}

/**
 * Three.js realization of immutable worker commits. Active collapse animations
 * use short-lived meshes; completed cells move into seven bounded instanced
 * batches instead of adding two permanent draw calls per observed cell.
 */
export class SliceCollapseVisuals implements CollapseVisualAdapter {
  readonly root = new Group();

  private readonly records = new Map<CellId, VisualRecord>();
  private readonly waves: WaveRecord[] = [];
  private readonly deepWaterCells = new Set<CellId>();
  private readonly terrainBatches = new Map<number, FixedBatch>();
  private readonly featureBatches = new Map<
    Exclude<SliceFeatureKind, 'empty'>,
    FixedBatch
  >();
  private readonly terrainGeometry = new BoxGeometry(1.94, 0.14, 1.94);
  private readonly featureGeometries: Readonly<
    Record<Exclude<SliceFeatureKind, 'empty'>, BufferGeometry>
  > = {
    tree: new ConeGeometry(0.55, 2.3, 6),
    flower: new SphereGeometry(0.18, 8, 6),
    rock: new IcosahedronGeometry(0.38, 0),
  };
  private readonly waveGeometry = new RingGeometry(0.7, 0.77, 24);
  private readonly matrix = new Matrix4();

  constructor(
    scene: Scene,
    private readonly worldState: WorldState,
    private readonly textures?: ProceduralTextureMaps,
  ) {
    this.root.name = 'fixed-observed-world';
    scene.add(this.root);
  }

  begin(event: CollapseEvent, center: WorldVector3): void {
    if (this.records.has(event.cellId)) return;
    const cell = this.worldState.getCellView(event.cellId);
    const style = classifySliceTile(event.cellId, cell.paletteEpoch);
    if (style.deepWater) this.deepWaterCells.add(event.cellId);

    const group = new Group();
    group.position.set(center[0], 0, center[2]);
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
      const featureMaterial = new MeshStandardMaterial({
        color: featureColor(style.feature),
        roughness: style.feature === 'flower' ? 0.75 : 0.9,
        emissive: style.feature === 'flower' ? 0x35101f : 0x000000,
        map: this.featureTexture(style.feature),
      });
      const feature = new Mesh(
        this.featureGeometries[style.feature],
        featureMaterial,
      );
      feature.position.y = featureHeight(style.feature);
      feature.castShadow = true;
      group.add(feature);
      transientMaterials.push(featureMaterial);
    }
    this.root.add(group);
    this.records.set(event.cellId, {
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
    this.addTerrainInstance(record);
    if (record.style.feature !== 'empty') {
      this.addFeatureInstance(record, record.style.feature);
    }
    record.group.removeFromParent();
    for (const material of record.transientMaterials) material.dispose();
    record.group.clear();
    this.records.delete(cellId);
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
    for (const batch of this.terrainBatches.values()) {
      batch.material.emissive.set(emissive);
    }
    for (const record of this.records.values()) {
      record.terrainMaterial.emissive.set(emissive);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    this.terrainGeometry.dispose();
    for (const geometry of Object.values(this.featureGeometries)) {
      geometry.dispose();
    }
    this.waveGeometry.dispose();
    this.records.clear();
    this.waves.length = 0;
    this.deepWaterCells.clear();
    this.terrainBatches.clear();
    this.featureBatches.clear();
    this.root.clear();
  }

  private addTerrainInstance(record: VisualRecord): void {
    let batch = this.terrainBatches.get(record.style.color);
    if (!batch) {
      const material = new MeshStandardMaterial({
        color: record.style.color,
        roughness: record.style.deepWater ? 0.24 : 0.92,
        metalness: record.style.deepWater ? 0.16 : 0,
        map: record.style.deepWater
          ? (this.textures?.water ?? null)
          : (this.textures?.meadow ?? null),
      });
      const mesh = new InstancedMesh(
        this.terrainGeometry,
        material,
        MAX_FIXED_WORLD_INSTANCES,
      );
      mesh.name = `fixed-terrain-${record.style.color.toString(16)}`;
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      batch = { mesh, material };
      this.terrainBatches.set(record.style.color, batch);
      this.root.add(mesh);
    }
    this.matrix.makeTranslation(
      record.group.position.x,
      record.style.deepWater ? -0.04 : 0.05,
      record.group.position.z,
    );
    batch.mesh.setMatrixAt(batch.mesh.count, this.matrix);
    batch.mesh.count += 1;
    batch.mesh.instanceMatrix.needsUpdate = true;
  }

  private addFeatureInstance(
    record: VisualRecord,
    kind: Exclude<SliceFeatureKind, 'empty'>,
  ): void {
    let batch = this.featureBatches.get(kind);
    if (!batch) {
      const material = new MeshStandardMaterial({
        color: featureColor(kind),
        roughness: kind === 'flower' ? 0.75 : 0.9,
        emissive: kind === 'flower' ? 0x35101f : 0x000000,
        map: this.featureTexture(kind),
      });
      const mesh = new InstancedMesh(
        this.featureGeometries[kind],
        material,
        MAX_FIXED_WORLD_INSTANCES,
      );
      mesh.name = `fixed-feature-${kind}`;
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      batch = { mesh, material };
      this.featureBatches.set(kind, batch);
      this.root.add(mesh);
    }
    this.matrix.makeTranslation(
      record.group.position.x,
      featureHeight(kind),
      record.group.position.z,
    );
    batch.mesh.setMatrixAt(batch.mesh.count, this.matrix);
    batch.mesh.count += 1;
    batch.mesh.instanceMatrix.needsUpdate = true;
  }

  private featureTexture(
    kind: Exclude<SliceFeatureKind, 'empty'>,
  ): ProceduralTextureMaps['foliage'] | null {
    if (!this.textures) return null;
    if (kind === 'tree') return this.textures.foliage;
    if (kind === 'flower') return this.textures.flower;
    return this.textures.stone;
  }
}
