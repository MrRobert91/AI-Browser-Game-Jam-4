import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  type Scene,
} from 'three';

import type { CollapseEvent } from '../contracts/messages';
import type { CellId, WorldVector3 } from '../contracts/world';
import type { CollapseVisualAdapter } from './collapse-director';
import type { WorldState } from './world-state';

export type SliceFeatureKind = 'empty' | 'tree' | 'flower' | 'rock';

export interface SliceTileStyle {
  readonly color: number;
  readonly deepWater: boolean;
  readonly feature: SliceFeatureKind;
}

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
}

interface WaveRecord {
  readonly mesh: Mesh<RingGeometry, MeshStandardMaterial>;
  ageSeconds: number;
}

function createFeature(kind: SliceFeatureKind): Mesh | null {
  switch (kind) {
    case 'tree':
      return new Mesh(
        new ConeGeometry(0.55, 2.3, 6),
        new MeshStandardMaterial({ color: 0x71a96d, roughness: 0.9 }),
      );
    case 'flower':
      return new Mesh(
        new SphereGeometry(0.18, 8, 6),
        new MeshStandardMaterial({ color: 0xff9ecf, emissive: 0x35101f }),
      );
    case 'rock':
      return new Mesh(
        new IcosahedronGeometry(0.38, 0),
        new MeshStandardMaterial({ color: 0x798387, roughness: 1 }),
      );
    case 'empty':
      return null;
  }
}

/** Three.js realization of immutable worker commits for the 90 s gate. */
export class SliceCollapseVisuals implements CollapseVisualAdapter {
  readonly root = new Group();

  private readonly records = new Map<CellId, VisualRecord>();
  private readonly waves: WaveRecord[] = [];
  private readonly deepWaterCells = new Set<CellId>();

  constructor(
    scene: Scene,
    private readonly worldState: WorldState,
  ) {
    this.root.name = 'fixed-observed-world';
    scene.add(this.root);
  }

  begin(event: CollapseEvent, center: WorldVector3): void {
    if (this.records.has(event.cellId)) return;
    const cell = this.worldState.getCell(event.cellId);
    const style = classifySliceTile(event.cellId, cell.paletteEpoch);
    if (style.deepWater) this.deepWaterCells.add(event.cellId);

    const group = new Group();
    group.position.set(center[0], 0, center[2]);
    group.scale.setScalar(0.85);
    const terrainMaterial = new MeshStandardMaterial({
      color: style.color,
      roughness: style.deepWater ? 0.24 : 0.92,
      metalness: style.deepWater ? 0.16 : 0,
      transparent: true,
      opacity: 0,
    });
    const terrain = new Mesh(
      new BoxGeometry(1.94, 0.14, 1.94),
      terrainMaterial,
    );
    terrain.position.y = style.deepWater ? -0.04 : 0.05;
    terrain.receiveShadow = true;
    group.add(terrain);

    const feature = createFeature(style.feature);
    if (feature) {
      feature.position.y = style.feature === 'tree' ? 1.2 : 0.28;
      feature.castShadow = true;
      group.add(feature);
    }
    this.root.add(group);
    this.records.set(event.cellId, { group, terrainMaterial });
  }

  update(cellId: CellId, progress: number): void {
    const record = this.records.get(cellId);
    if (!record) return;
    const eased = 1 - Math.pow(1 - progress, 3);
    record.group.scale.setScalar(0.85 + eased * 0.15);
    record.terrainMaterial.opacity = eased;
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
    const mesh = new Mesh(new RingGeometry(0.7, 0.77, 24), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(record.group.position);
    mesh.position.y = 0.12;
    this.root.add(mesh);
    this.waves.push({ mesh, ageSeconds: 0 });
  }

  complete(cellId: CellId): void {
    const record = this.records.get(cellId);
    if (!record) return;
    record.group.scale.setScalar(1);
    record.terrainMaterial.opacity = 1;
    record.terrainMaterial.transparent = false;
  }

  updateFrame(deltaSeconds: number): void {
    for (let index = this.waves.length - 1; index >= 0; index -= 1) {
      const wave = this.waves[index]!;
      wave.ageSeconds += deltaSeconds;
      wave.mesh.scale.setScalar(1 + wave.ageSeconds * 3.2);
      wave.mesh.material.opacity = Math.max(0, 0.75 - wave.ageSeconds * 1.5);
      if (wave.ageSeconds >= 0.5) {
        this.root.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        wave.mesh.material.dispose();
        this.waves.splice(index, 1);
      }
    }
  }

  isDeepWater(cellId: CellId): boolean {
    return this.deepWaterCells.has(cellId);
  }

  setEndingMode(enabled: boolean): void {
    for (const record of this.records.values()) {
      record.terrainMaterial.emissive.set(enabled ? 0x102318 : 0x000000);
    }
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
    this.records.clear();
    this.waves.length = 0;
    this.deepWaterCells.clear();
  }
}
