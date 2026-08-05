import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
  type PerspectiveCamera,
} from 'three';

import { updateCameraAspect } from '../player/camera';
import { createAtmosphere, type Atmosphere } from './atmosphere';
import {
  DynamicResolutionController,
  resolveQualityProfile,
  type QualityPreset,
  type QualityProfile,
} from './quality';

export interface GameRendererOptions {
  readonly container: HTMLElement;
  readonly camera: PerspectiveCamera;
  readonly quality?: QualityPreset;
}

export class GameRenderer {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly #container: HTMLElement;
  readonly #atmosphere: Atmosphere;
  readonly #resolution: DynamicResolutionController;
  #profile: QualityProfile;
  #lastRenderTime: number | null = null;

  constructor(options: GameRendererOptions) {
    this.#container = options.container;
    this.camera = options.camera;
    this.#profile = resolveQualityProfile(options.quality ?? 'auto');
    this.#resolution = new DynamicResolutionController(this.#profile);

    const canvas = document.createElement('canvas');
    canvas.className = 'game-viewport__canvas';
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: this.#profile.preset !== 'low',
      depth: true,
      powerPreference: 'high-performance',
    });
    if (context === null) {
      throw new Error('Este navegador no ofrece el contexto WebGL2 requerido.');
    }

    this.renderer = new WebGLRenderer({ canvas, context, antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.#atmosphere = createAtmosphere(this.scene, this.#profile);
    this.#container.replaceChildren(canvas);
    this.#applyQuality();
    this.resize();
  }

  get quality(): QualityProfile {
    return this.#profile;
  }

  setQuality(preset: QualityPreset): void {
    this.#profile = resolveQualityProfile(preset);
    this.#resolution.setProfile(this.#profile);
    this.#atmosphere.applyQuality(this.#profile);
    this.#applyQuality();
    this.resize();
  }

  resize(): void {
    const width = Math.max(1, this.#container.clientWidth);
    const height = Math.max(1, this.#container.clientHeight);
    updateCameraAspect(this.camera, width, height);
    this.renderer.setSize(width, height, false);
  }

  render(timestamp = performance.now()): void {
    if (this.#lastRenderTime !== null) {
      const before = this.#resolution.scale;
      const after = this.#resolution.sampleFrame(
        timestamp - this.#lastRenderTime,
      );
      if (after !== before) {
        this.#applyPixelRatio();
        this.resize();
      }
    }
    this.#lastRenderTime = timestamp;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#atmosphere.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  #applyQuality(): void {
    this.renderer.shadowMap.enabled = this.#profile.shadows;
    this.#applyPixelRatio();
  }

  #applyPixelRatio(): void {
    const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(deviceRatio * this.#resolution.scale);
  }
}
