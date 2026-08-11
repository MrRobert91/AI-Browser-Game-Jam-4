import {
  ACESFilmicToneMapping,
  Color,
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
  nextLowerQuality,
  resolveQualityProfile,
  type QualityPreset,
  type QualityProfile,
} from './quality';
import { WorldPostprocessing } from './postprocessing';
import {
  createProceduralTextureLibrary,
  type ProceduralTextureLibrary,
} from './textures';

export interface GameRendererOptions {
  readonly container: HTMLElement;
  readonly camera: PerspectiveCamera;
  readonly quality?: QualityPreset;
}

export interface GameRendererPerformanceSnapshot {
  readonly preset: QualityProfile['preset'];
  readonly resolutionScale: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly bloomEnabled: boolean;
  readonly ssaoEnabled: boolean;
  readonly drawingBufferWidth: number;
  readonly drawingBufferHeight: number;
}

export class GameRenderer {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly textures: ProceduralTextureLibrary;
  readonly #container: HTMLElement;
  readonly #atmosphere: Atmosphere;
  readonly #resolution: DynamicResolutionController;
  readonly #postprocessing: WorldPostprocessing;
  readonly #qualityListeners = new Set<(profile: QualityProfile) => void>();
  #profile: QualityProfile;
  #requestedQuality: QualityPreset;
  #lastRenderTime: number | null = null;
  #slowFramesAtMinimum = 0;

  constructor(options: GameRendererOptions) {
    this.#container = options.container;
    this.camera = options.camera;
    this.#requestedQuality = options.quality ?? 'auto';
    this.#profile = resolveQualityProfile(this.#requestedQuality);
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

    this.renderer = new WebGLRenderer({ canvas, context });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.textures = createProceduralTextureLibrary();
    this.#atmosphere = createAtmosphere(
      this.scene,
      this.#profile,
      this.textures,
    );
    this.#postprocessing = new WorldPostprocessing(
      this.renderer,
      this.scene,
      this.camera,
      this.#profile,
    );
    this.#container.replaceChildren(canvas);
    this.#applyQuality();
    this.resize();
  }

  get quality(): QualityProfile {
    return this.#profile;
  }

  get performanceSnapshot(): GameRendererPerformanceSnapshot {
    const postprocessing = this.#postprocessing.state;
    return {
      preset: this.#profile.preset,
      resolutionScale: this.#resolution.scale,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      ...postprocessing,
      drawingBufferWidth: this.renderer.domElement.width,
      drawingBufferHeight: this.renderer.domElement.height,
    };
  }

  setQuality(preset: QualityPreset): void {
    this.#requestedQuality = preset;
    this.#slowFramesAtMinimum = 0;
    this.#setResolvedQuality(resolveQualityProfile(preset));
  }

  setWorldAtmosphereVisible(visible: boolean): void {
    this.#atmosphere.group.visible = visible;
    if (!visible) {
      this.scene.fog = null;
      this.scene.background = new Color(0x071018);
    } else {
      this.#atmosphere.applyQuality(this.#profile);
    }
  }

  onQualityChange(listener: (profile: QualityProfile) => void): () => void {
    this.#qualityListeners.add(listener);
    listener(this.#profile);
    return () => this.#qualityListeners.delete(listener);
  }

  #setResolvedQuality(profile: QualityProfile): void {
    this.#profile = profile;
    this.#resolution.setProfile(this.#profile);
    this.#atmosphere.applyQuality(this.#profile);
    this.#postprocessing.applyQuality(this.#profile);
    this.#applyQuality();
    this.resize();
    for (const listener of this.#qualityListeners) listener(this.#profile);
  }

  resize(): void {
    const width = Math.max(1, this.#container.clientWidth);
    const height = Math.max(1, this.#container.clientHeight);
    updateCameraAspect(this.camera, width, height);
    this.renderer.setSize(width, height, false);
    this.#postprocessing.setSize(
      width,
      height,
      this.#devicePixelRatio() * this.#resolution.scale,
    );
  }

  render(timestamp = performance.now()): void {
    if (this.#lastRenderTime !== null) {
      const frameTimeMs = timestamp - this.#lastRenderTime;
      const before = this.#resolution.scale;
      const after = this.#resolution.sampleFrame(frameTimeMs);
      const qualityChanged = this.#adaptAutomaticQuality(frameTimeMs);
      if (!qualityChanged && after !== before) {
        this.#applyPixelRatio();
        this.resize();
      }
    }
    const deltaSeconds =
      this.#lastRenderTime === null
        ? 0
        : Math.min(0.1, Math.max(0, timestamp - this.#lastRenderTime) / 1_000);
    this.#lastRenderTime = timestamp;
    this.#postprocessing.render(deltaSeconds);
  }

  dispose(): void {
    this.#atmosphere.dispose();
    this.#postprocessing.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  #applyQuality(): void {
    this.renderer.shadowMap.enabled = this.#profile.shadows;
    this.#applyPixelRatio();
  }

  #applyPixelRatio(): void {
    this.renderer.setPixelRatio(
      this.#devicePixelRatio() * this.#resolution.scale,
    );
  }

  #devicePixelRatio(): number {
    return Math.min(
      window.devicePixelRatio || 1,
      this.#profile.maxDevicePixelRatio,
    );
  }

  #adaptAutomaticQuality(frameTimeMs: number): boolean {
    if (
      this.#requestedQuality !== 'auto' ||
      this.#profile.preset === 'low' ||
      !this.#resolution.atMinimum
    ) {
      this.#slowFramesAtMinimum = 0;
      return false;
    }
    if (frameTimeMs <= 30) {
      this.#slowFramesAtMinimum = 0;
      return false;
    }
    this.#slowFramesAtMinimum += 1;
    if (this.#slowFramesAtMinimum < 2) return false;
    this.#slowFramesAtMinimum = 0;
    this.#setResolvedQuality(
      resolveQualityProfile(nextLowerQuality(this.#profile.preset)),
    );
    return true;
  }
}
