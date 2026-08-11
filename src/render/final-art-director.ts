import type { Scene } from 'three';

import {
  createStylizedMaterialLibrary,
  type StylizedMaterialLibrary,
} from './materials';
import type { QualityProfile } from './quality';
import type { ProceduralTextureLibrary } from './textures';
import { ProceduralVegetationField } from './vegetation';

export class FinalArtDirector {
  readonly materials: StylizedMaterialLibrary;
  readonly vegetation: ProceduralVegetationField;

  constructor(
    scene: Scene,
    profile: QualityProfile,
    textures?: ProceduralTextureLibrary,
  ) {
    this.materials = createStylizedMaterialLibrary(textures);
    this.vegetation = new ProceduralVegetationField(
      scene,
      this.materials,
      profile,
    );
  }

  applyQuality(profile: QualityProfile): void {
    this.vegetation.applyQuality(profile);
  }

  update(elapsedSeconds: number): void {
    this.vegetation.update(elapsedSeconds);
  }

  dispose(): void {
    this.vegetation.dispose();
    this.materials.dispose();
  }
}
