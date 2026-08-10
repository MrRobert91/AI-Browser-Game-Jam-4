export type QualityPreset = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedQualityPreset = Exclude<QualityPreset, 'auto'>;

export interface QualityProfile {
  readonly preset: ResolvedQualityPreset;
  readonly minResolutionScale: number;
  readonly maxResolutionScale: number;
  readonly maxDevicePixelRatio: 1 | 1.5 | 2;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly shadows: boolean;
  readonly shadowMapSize: 512 | 1024 | 2048;
  readonly maxSuperpositionCandidates: 2 | 3;
  readonly particles: boolean;
  readonly aggressiveLod: boolean;
}

export interface HardwareHints {
  readonly hardwareConcurrency?: number;
  readonly deviceMemoryGb?: number;
}

const PROFILES: Readonly<Record<ResolvedQualityPreset, QualityProfile>> = {
  low: {
    preset: 'low',
    minResolutionScale: 0.35,
    maxResolutionScale: 0.75,
    maxDevicePixelRatio: 1,
    fogNear: 18,
    fogFar: 45,
    shadows: false,
    shadowMapSize: 512,
    maxSuperpositionCandidates: 2,
    particles: false,
    aggressiveLod: true,
  },
  medium: {
    preset: 'medium',
    minResolutionScale: 0.6,
    maxResolutionScale: 0.9,
    maxDevicePixelRatio: 1.5,
    fogNear: 22,
    fogFar: 55,
    shadows: true,
    shadowMapSize: 1024,
    maxSuperpositionCandidates: 3,
    particles: true,
    aggressiveLod: false,
  },
  high: {
    preset: 'high',
    minResolutionScale: 0.7,
    maxResolutionScale: 1,
    maxDevicePixelRatio: 2,
    fogNear: 25,
    fogFar: 65,
    shadows: true,
    shadowMapSize: 2048,
    maxSuperpositionCandidates: 3,
    particles: true,
    aggressiveLod: false,
  },
};

export function resolveQualityProfile(
  preset: QualityPreset,
  hardware: HardwareHints = browserHardwareHints(),
): QualityProfile {
  const resolved = preset === 'auto' ? autoPreset(hardware) : preset;
  return PROFILES[resolved];
}

export function autoPreset(hardware: HardwareHints): ResolvedQualityPreset {
  const cores = hardware.hardwareConcurrency ?? 4;
  const memory = hardware.deviceMemoryGb ?? 4;
  // CPU/RAM hints are only weak GPU proxies. Auto therefore starts
  // conservatively; players can still explicitly request richer presets.
  if (cores <= 8 || memory <= 8) return 'low';
  if (cores >= 16 && memory >= 12) return 'high';
  return 'medium';
}

export function nextLowerQuality(
  preset: ResolvedQualityPreset,
): ResolvedQualityPreset {
  if (preset === 'high') return 'medium';
  if (preset === 'medium') return 'low';
  return 'low';
}

/** Adjusts only render resolution; it never observes or mutates solver state. */
export class DynamicResolutionController {
  #profile: QualityProfile;
  #scale: number;
  #averageFrameTimeMs = 0;
  #sampleCount = 0;
  #slowFrameStreak = 0;
  #fastFrameStreak = 0;

  constructor(profile: QualityProfile) {
    this.#profile = profile;
    this.#scale = profile.maxResolutionScale;
  }

  get scale(): number {
    return this.#scale;
  }

  get atMinimum(): boolean {
    return this.#scale <= this.#profile.minResolutionScale + 0.001;
  }

  setProfile(profile: QualityProfile): void {
    this.#profile = profile;
    this.#scale = clamp(
      this.#scale,
      profile.minResolutionScale,
      profile.maxResolutionScale,
    );
    this.#averageFrameTimeMs = 0;
    this.#sampleCount = 0;
    this.#slowFrameStreak = 0;
    this.#fastFrameStreak = 0;
  }

  sampleFrame(frameTimeMs: number): number {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs < 0) {
      throw new RangeError('frameTimeMs must be a finite non-negative number');
    }
    const boundedFrameTime = Math.min(frameTimeMs, 250);
    this.#averageFrameTimeMs =
      this.#sampleCount === 0
        ? boundedFrameTime
        : this.#averageFrameTimeMs * 0.85 + boundedFrameTime * 0.15;
    this.#sampleCount += 1;

    if (frameTimeMs >= 50) {
      // At very low FPS, waiting for a 30-frame window can leave the game
      // unresponsive for tens of seconds. React on every emergency frame.
      this.#scale -= 0.1;
      this.#slowFrameStreak = 0;
      this.#fastFrameStreak = 0;
    } else if (this.#averageFrameTimeMs > 22) {
      this.#slowFrameStreak += 1;
      this.#fastFrameStreak = 0;
      if (this.#slowFrameStreak >= 4) {
        this.#scale -= 0.05;
        this.#slowFrameStreak = 0;
      }
    } else if (this.#averageFrameTimeMs < 14) {
      this.#fastFrameStreak += 1;
      this.#slowFrameStreak = 0;
      if (this.#fastFrameStreak >= 120) {
        this.#scale += 0.025;
        this.#fastFrameStreak = 0;
      }
    } else {
      this.#slowFrameStreak = 0;
      this.#fastFrameStreak = 0;
    }
    this.#scale = clamp(
      this.#scale,
      this.#profile.minResolutionScale,
      this.#profile.maxResolutionScale,
    );
    return this.#scale;
  }
}

function browserHardwareHints(): HardwareHints {
  if (typeof navigator === 'undefined') return {};
  const navigatorWithMemory = navigator as Navigator & {
    readonly deviceMemory?: number;
  };
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    ...(navigatorWithMemory.deviceMemory === undefined
      ? {}
      : { deviceMemoryGb: navigatorWithMemory.deviceMemory }),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
