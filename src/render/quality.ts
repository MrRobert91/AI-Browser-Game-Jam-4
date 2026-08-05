export type QualityPreset = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedQualityPreset = Exclude<QualityPreset, 'auto'>;

export interface QualityProfile {
  readonly preset: ResolvedQualityPreset;
  readonly minResolutionScale: number;
  readonly maxResolutionScale: number;
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
    minResolutionScale: 0.7,
    maxResolutionScale: 0.78,
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
    minResolutionScale: 0.7,
    maxResolutionScale: 0.9,
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
  if (cores <= 4 || memory <= 4) return 'low';
  if (cores >= 10 && memory >= 8) return 'high';
  return 'medium';
}

/** Adjusts only render resolution; it never observes or mutates solver state. */
export class DynamicResolutionController {
  #profile: QualityProfile;
  #scale: number;
  #frameTimeTotal = 0;
  #sampleCount = 0;

  constructor(profile: QualityProfile) {
    this.#profile = profile;
    this.#scale = profile.maxResolutionScale;
  }

  get scale(): number {
    return this.#scale;
  }

  setProfile(profile: QualityProfile): void {
    this.#profile = profile;
    this.#scale = clamp(
      this.#scale,
      profile.minResolutionScale,
      profile.maxResolutionScale,
    );
    this.#frameTimeTotal = 0;
    this.#sampleCount = 0;
  }

  sampleFrame(frameTimeMs: number): number {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs < 0) {
      throw new RangeError('frameTimeMs must be a finite non-negative number');
    }
    this.#frameTimeTotal += frameTimeMs;
    this.#sampleCount += 1;
    if (this.#sampleCount < 30) return this.#scale;

    const average = this.#frameTimeTotal / this.#sampleCount;
    if (average > 22) this.#scale -= 0.05;
    else if (average < 15) this.#scale += 0.025;
    this.#scale = clamp(
      this.#scale,
      this.#profile.minResolutionScale,
      this.#profile.maxResolutionScale,
    );
    this.#frameTimeTotal = 0;
    this.#sampleCount = 0;
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
