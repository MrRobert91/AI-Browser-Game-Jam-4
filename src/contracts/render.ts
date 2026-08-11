import type { Texture } from 'three';

/** Shared texture surface exposed to render consumers without subsystem imports. */
export interface ProceduralTextureMaps {
  readonly meadow: Texture;
  readonly ground: Texture;
  readonly foliage: Texture;
  readonly bark: Texture;
  readonly stone: Texture;
  readonly water: Texture;
  readonly flower: Texture;
  readonly hazard: Texture;
}
