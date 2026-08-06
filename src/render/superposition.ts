import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';

import type { CellId, WorldVector3 } from '../contracts/world';

export const MAX_VISIBLE_SUPERPOSITION_PROXIES = 120;
export const SUPERPOSITION_MIN_INTERVAL_MS = 160;
export const SUPERPOSITION_MAX_INTERVAL_MS = 260;

export type SuperpositionQuality = 'low' | 'medium' | 'high';
export type ProxyFamily = 'ground' | 'organic' | 'mineral' | 'structure';

export interface SuperpositionCandidate {
  readonly tileId: number;
  readonly family: ProxyFamily;
  readonly weight: number;
}

export interface SuperpositionCell {
  readonly cellId: CellId;
  readonly center: WorldVector3;
  readonly observationCharge: number;
  readonly candidates: readonly SuperpositionCandidate[];
}

export interface ProxySelection {
  readonly candidate: SuperpositionCandidate | null;
  readonly alternativesRemaining: number;
  readonly intervalMs: number;
  readonly opacity: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hashCell(cellId: CellId): number {
  let value = cellId | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function selectSuperpositionProxy(
  cell: SuperpositionCell,
  elapsedMs: number,
  quality: SuperpositionQuality,
): ProxySelection {
  const maximumCandidates = quality === 'low' ? 2 : 3;
  const ranked = [...cell.candidates]
    .filter((candidate) => candidate.weight > 0)
    .sort(
      (left, right) => right.weight - left.weight || left.tileId - right.tileId,
    )
    .slice(0, maximumCandidates);
  const charge = clamp01(cell.observationCharge);
  const alternativesRemaining = Math.max(
    ranked.length > 0 ? 1 : 0,
    Math.ceil(ranked.length * (1 - charge)),
  );
  const available = ranked.slice(0, alternativesRemaining);
  const hash = hashCell(cell.cellId);
  const intervalMs =
    SUPERPOSITION_MIN_INTERVAL_MS +
    (hash %
      (SUPERPOSITION_MAX_INTERVAL_MS - SUPERPOSITION_MIN_INTERVAL_MS + 1));
  const frame = Math.floor(Math.max(0, elapsedMs) / intervalMs);
  const candidate =
    available.length === 0
      ? null
      : (available[(frame + (hash % available.length)) % available.length] ??
        null);

  return {
    candidate,
    alternativesRemaining,
    intervalMs,
    opacity: 0.12 + (1 - charge) * 0.42,
  };
}

function proxyMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 0.42 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      uniform float uTime;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec3 displaced = position;
        displaced.y += sin((position.x + position.z) * 5.0 + uTime * 2.0) * 0.025;
        vec4 world = modelMatrix * instanceMatrix * vec4(displaced, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDirection)), 2.0);
        float shimmer = 0.82 + 0.18 * sin(vWorldPosition.x * 3.1 + vWorldPosition.z * 2.7 + uTime * 4.0);
        gl_FragColor = vec4(uColor * shimmer, uOpacity * (0.35 + fresnel * 0.65));
      }
    `,
  });
}

interface ProxyPool {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  count: number;
  opacityTotal: number;
}

function geometryFor(family: ProxyFamily): BufferGeometry {
  switch (family) {
    case 'organic':
      return new ConeGeometry(0.65, 1.8, 5);
    case 'mineral':
      return new IcosahedronGeometry(0.72, 0);
    case 'structure':
      return new BoxGeometry(1.15, 1.9, 0.35);
    case 'ground':
      return new BoxGeometry(1.85, 0.12, 1.85);
  }
}

const FAMILY_COLORS: Readonly<Record<ProxyFamily, number>> = {
  ground: 0x70e6ff,
  organic: 0x9fffb6,
  mineral: 0xce9dff,
  structure: 0xffdf91,
};

/** One shared low-poly geometry/material pool per proxy family. */
export class SuperpositionRenderer {
  readonly root = new Group();

  private readonly pools = new Map<ProxyFamily, ProxyPool>();
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private highContrast = false;

  constructor(private quality: SuperpositionQuality = 'medium') {
    for (const family of Object.keys(FAMILY_COLORS) as ProxyFamily[]) {
      const material = proxyMaterial(FAMILY_COLORS[family]);
      const mesh = new InstancedMesh(
        geometryFor(family),
        material,
        MAX_VISIBLE_SUPERPOSITION_PROXIES,
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.pools.set(family, { mesh, material, count: 0, opacityTotal: 0 });
    }
  }

  setQuality(quality: SuperpositionQuality): void {
    this.quality = quality;
  }

  setHighContrast(enabled: boolean): void {
    this.highContrast = enabled;
  }

  update(cells: readonly SuperpositionCell[], elapsedMs: number): number {
    for (const pool of this.pools.values()) {
      pool.count = 0;
      pool.opacityTotal = 0;
    }

    let visibleCount = 0;
    for (const cell of cells) {
      if (visibleCount >= MAX_VISIBLE_SUPERPOSITION_PROXIES) {
        break;
      }
      const selection = selectSuperpositionProxy(cell, elapsedMs, this.quality);
      if (!selection.candidate) {
        continue;
      }
      const pool = this.pools.get(selection.candidate.family)!;
      this.position.set(cell.center[0], cell.center[1], cell.center[2]);
      this.matrix.makeTranslation(this.position);
      pool.mesh.setMatrixAt(pool.count, this.matrix);
      pool.count += 1;
      pool.opacityTotal += selection.opacity;
      visibleCount += 1;
    }

    for (const pool of this.pools.values()) {
      pool.mesh.count = pool.count;
      pool.mesh.instanceMatrix.needsUpdate = pool.count > 0;
      pool.material.uniforms.uTime!.value = elapsedMs / 1_000;
      pool.material.uniforms.uOpacity!.value =
        pool.count > 0
          ? Math.min(
              0.9,
              (pool.opacityTotal / pool.count) * (this.highContrast ? 1.45 : 1),
            )
          : 0;
    }
    return visibleCount;
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      pool.mesh.geometry.dispose();
      pool.material.dispose();
    }
    this.pools.clear();
    this.root.clear();
  }
}
