import {
  OrthographicCamera,
  SRGBColorSpace,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from 'three';

import type { CellId } from '../contracts/world';

export const PANORAMA_WIDTH = 1600;
export const PANORAMA_HEIGHT = 900;
export const PANORAMA_PADDING_METERS = 4;

export interface ObservedWorldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly fixedCellCount: number;
}

export function observedWorldBounds(
  fixedCellIds: readonly CellId[],
  cellsPerSide = 64,
  cellSizeMeters = 2,
  paddingMeters = PANORAMA_PADDING_METERS,
): ObservedWorldBounds {
  const fallbackCenter = (cellsPerSide * cellSizeMeters) / 2;
  if (fixedCellIds.length === 0) {
    return {
      minX: fallbackCenter - cellSizeMeters,
      maxX: fallbackCenter + cellSizeMeters,
      minZ: fallbackCenter - cellSizeMeters,
      maxZ: fallbackCenter + cellSizeMeters,
      centerX: fallbackCenter,
      centerZ: fallbackCenter,
      fixedCellCount: 0,
    };
  }
  let minCellX = cellsPerSide;
  let maxCellX = 0;
  let minCellZ = cellsPerSide;
  let maxCellZ = 0;
  for (const cellId of fixedCellIds) {
    const x = cellId % cellsPerSide;
    const z = Math.floor(cellId / cellsPerSide);
    minCellX = Math.min(minCellX, x);
    maxCellX = Math.max(maxCellX, x);
    minCellZ = Math.min(minCellZ, z);
    maxCellZ = Math.max(maxCellZ, z);
  }
  const worldSize = cellsPerSide * cellSizeMeters;
  const minX = Math.max(0, minCellX * cellSizeMeters - paddingMeters);
  const maxX = Math.min(
    worldSize,
    (maxCellX + 1) * cellSizeMeters + paddingMeters,
  );
  const minZ = Math.max(0, minCellZ * cellSizeMeters - paddingMeters);
  const maxZ = Math.min(
    worldSize,
    (maxCellZ + 1) * cellSizeMeters + paddingMeters,
  );
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    fixedCellCount: fixedCellIds.length,
  };
}

export function panoramaFrustum(
  bounds: ObservedWorldBounds,
  aspect = PANORAMA_WIDTH / PANORAMA_HEIGHT,
): { readonly halfWidth: number; readonly halfHeight: number } {
  const contentWidth = Math.max(4, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(4, bounds.maxZ - bounds.minZ);
  const halfWidth = Math.max(contentWidth / 2, (contentHeight * aspect) / 2);
  const halfHeight = Math.max(contentHeight / 2, contentWidth / aspect / 2);
  return { halfWidth, halfHeight };
}

/** Renders a fog-free, top-down map to an isolated target without moving gameplay camera. */
export function renderObservedWorldMapCanvas(
  renderer: WebGLRenderer,
  scene: Scene,
  fixedCellIds: readonly CellId[],
): HTMLCanvasElement {
  const bounds = observedWorldBounds(fixedCellIds);
  const { halfWidth, halfHeight } = panoramaFrustum(bounds);
  const camera = new OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    180,
  );
  camera.position.set(bounds.centerX, 96, bounds.centerZ);
  camera.up.set(0, 0, -1);
  camera.lookAt(bounds.centerX, 0, bounds.centerZ);
  camera.updateProjectionMatrix();

  const target = new WebGLRenderTarget(PANORAMA_WIDTH, PANORAMA_HEIGHT, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = SRGBColorSpace;
  const priorTarget = renderer.getRenderTarget();
  const priorFog = scene.fog;
  const pixels = new Uint8Array(PANORAMA_WIDTH * PANORAMA_HEIGHT * 4);
  try {
    scene.fog = null;
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(
      target,
      0,
      0,
      PANORAMA_WIDTH,
      PANORAMA_HEIGHT,
      pixels,
    );
  } finally {
    renderer.setRenderTarget(priorTarget);
    scene.fog = priorFog;
    target.dispose();
  }

  const canvas = document.createElement('canvas');
  canvas.width = PANORAMA_WIDTH;
  canvas.height = PANORAMA_HEIGHT;
  canvas.dataset.fixedCellCount = String(bounds.fixedCellCount);
  canvas.dataset.worldBounds = [
    bounds.minX,
    bounds.minZ,
    bounds.maxX,
    bounds.maxZ,
  ].join(',');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not encode the world map.');
  const image = context.createImageData(PANORAMA_WIDTH, PANORAMA_HEIGHT);
  const rowBytes = PANORAMA_WIDTH * 4;
  for (let y = 0; y < PANORAMA_HEIGHT; y += 1) {
    const sourceOffset = (PANORAMA_HEIGHT - y - 1) * rowBytes;
    image.data.set(
      pixels.subarray(sourceOffset, sourceOffset + rowBytes),
      y * rowBytes,
    );
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
