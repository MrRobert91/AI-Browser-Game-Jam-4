import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';

import type { ProceduralTextureMaps } from '../contracts/render';

export const PROCEDURAL_TEXTURE_SIZE = 64;
export const PROCEDURAL_TEXTURE_BYTES =
  PROCEDURAL_TEXTURE_SIZE * PROCEDURAL_TEXTURE_SIZE * 4;

export type ProceduralTextureKind =
  | 'meadow'
  | 'ground'
  | 'foliage'
  | 'bark'
  | 'stone'
  | 'water'
  | 'flower'
  | 'hazard';

export interface ProceduralTextureLibrary extends ProceduralTextureMaps {
  readonly meadow: DataTexture;
  readonly ground: DataTexture;
  readonly foliage: DataTexture;
  readonly bark: DataTexture;
  readonly stone: DataTexture;
  readonly water: DataTexture;
  readonly flower: DataTexture;
  readonly hazard: DataTexture;
  readonly all: readonly DataTexture[];
  readonly gpuBytes: number;
  dispose(): void;
}

const TEXTURE_SALTS: Readonly<Record<ProceduralTextureKind, number>> = {
  meadow: 0x45d9f3b,
  ground: 0x119de1f3,
  foliage: 0x27d4eb2d,
  bark: 0x165667b1,
  stone: 0x9e3779b9,
  water: 0x7f4a7c15,
  flower: 0x94d049bb,
  hazard: 0xed5ad4bb,
};

function hashByte(x: number, y: number, salt: number): number {
  let value = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, salt);
  value = Math.imul(value ^ (value >>> 16), 0x27d4eb2d);
  return (value ^ (value >>> 15)) & 0xff;
}

function luminanceFor(
  kind: ProceduralTextureKind,
  x: number,
  y: number,
): number {
  const noise = hashByte(x, y, TEXTURE_SALTS[kind]);
  if (kind === 'water') {
    const wave = Math.sin(y * 0.55 + Math.sin(x * 0.18) * 2.2);
    return Math.round(205 + wave * 27 + (noise - 128) * 0.08);
  }
  if (kind === 'stone') {
    const crack = (x * 3 + y * 5 + (noise >> 5)) % 23 < 2;
    return crack ? 118 : 190 + (noise >> 3);
  }
  if (kind === 'bark') {
    const groove = (x + Math.floor(Math.sin(y * 0.32) * 2)) % 9 < 2;
    return groove ? 125 : 186 + (noise >> 3);
  }
  if (kind === 'foliage') {
    const vein = (x + y * 2) % 17 === 0;
    return vein ? 152 : 196 + (noise >> 3);
  }
  if (kind === 'flower') {
    const petal = (x % 13) ** 2 + (y % 13) ** 2 < 18;
    return petal ? 255 : 185 + (noise >> 3);
  }
  if (kind === 'hazard') {
    const pulse = (x + y) % 12 < 3;
    return pulse ? 248 : 170 + (noise >> 3);
  }
  const blade = (x * 5 + y * 3 + (noise >> 6)) % 19 < 3;
  const base = kind === 'ground' ? 176 : 190;
  return blade ? base - 34 : base + (noise >> 3);
}

function createTexture(
  kind: ProceduralTextureKind,
  repeat: number,
): DataTexture {
  const data = new Uint8Array(PROCEDURAL_TEXTURE_BYTES);
  for (let y = 0; y < PROCEDURAL_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < PROCEDURAL_TEXTURE_SIZE; x += 1) {
      const offset = (y * PROCEDURAL_TEXTURE_SIZE + x) * 4;
      const luminance = Math.max(0, Math.min(255, luminanceFor(kind, x, y)));
      data[offset] = luminance;
      data[offset + 1] = luminance;
      data[offset + 2] = luminance;
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(
    data,
    PROCEDURAL_TEXTURE_SIZE,
    PROCEDURAL_TEXTURE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.name = `procedural-${kind}-64`;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

/** Eight tiny shared maps add material detail for roughly 128 KiB before mipmaps. */
export function createProceduralTextureLibrary(): ProceduralTextureLibrary {
  const meadow = createTexture('meadow', 2);
  const ground = createTexture('ground', 32);
  const foliage = createTexture('foliage', 3);
  const bark = createTexture('bark', 3);
  const stone = createTexture('stone', 2);
  const water = createTexture('water', 2);
  const flower = createTexture('flower', 2);
  const hazard = createTexture('hazard', 2);
  const all = [
    meadow,
    ground,
    foliage,
    bark,
    stone,
    water,
    flower,
    hazard,
  ] as const;
  return {
    meadow,
    ground,
    foliage,
    bark,
    stone,
    water,
    flower,
    hazard,
    all,
    gpuBytes: all.length * PROCEDURAL_TEXTURE_BYTES,
    dispose: () => all.forEach((texture) => texture.dispose()),
  };
}
