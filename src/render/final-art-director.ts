import type { Scene } from 'three';

import { createStylizedMaterialLibrary } from './materials';
import type { QualityProfile } from './quality';
import { ProceduralVegetationField } from './vegetation';

export class FinalArtDirector {
  readonly materials = createStylizedMaterialLibrary();
  readonly vegetation: ProceduralVegetationField;

  constructor(scene: Scene, profile: QualityProfile) {
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
