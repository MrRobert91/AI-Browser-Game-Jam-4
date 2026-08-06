import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import type { QualityProfile } from './quality';

export interface PostprocessingState {
  readonly bloomEnabled: boolean;
  readonly ssaoEnabled: boolean;
}

/** Selective-by-luminance bloom plus high-only SSAO. */
export class WorldPostprocessing {
  private readonly composer: EffectComposer;
  private readonly ssao: SSAOPass;
  private readonly bloom: UnrealBloomPass;

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    profile: QualityProfile,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ssao = new SSAOPass(scene, camera, 1, 1, 16);
    this.ssao.kernelRadius = 7;
    this.ssao.minDistance = 0.002;
    this.ssao.maxDistance = 0.09;
    this.composer.addPass(this.ssao);
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.5, 0.34, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.applyQuality(profile);
  }

  get state(): PostprocessingState {
    return {
      bloomEnabled: this.bloom.enabled,
      ssaoEnabled: this.ssao.enabled,
    };
  }

  applyQuality(profile: QualityProfile): void {
    this.ssao.enabled = profile.preset === 'high';
    this.bloom.enabled = profile.preset !== 'low';
    this.bloom.strength = profile.preset === 'high' ? 0.62 : 0.42;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(deltaSeconds: number): void {
    this.composer.render(Math.max(0, deltaSeconds));
  }

  dispose(): void {
    this.composer.dispose();
  }
}
