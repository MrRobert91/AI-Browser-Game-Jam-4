export const DANGER_START_METERS = 14;
export const DANGER_FULL_METERS = 52;
export const RARITY_START_METERS = 8;
export const RARITY_FULL_METERS = 52;
export const RARITY_MINIMUM_MULTIPLIER = 0.65;
export const RARITY_MAXIMUM_MULTIPLIER = 1.8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  if (edge1 <= edge0) throw new RangeError('edge1 must be greater than edge0');
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function danger01(distanceFromOrigin: number): number {
  return smoothstep(
    DANGER_START_METERS,
    DANGER_FULL_METERS,
    Math.max(0, distanceFromOrigin),
  );
}

export function rarityMultiplier(distanceFromOrigin: number): number {
  if (distanceFromOrigin <= RARITY_START_METERS) {
    return RARITY_MINIMUM_MULTIPLIER;
  }
  if (distanceFromOrigin >= RARITY_FULL_METERS) {
    return RARITY_MAXIMUM_MULTIPLIER;
  }
  const progress = smoothstep(
    RARITY_START_METERS,
    RARITY_FULL_METERS,
    Math.max(0, distanceFromOrigin),
  );
  return (
    RARITY_MINIMUM_MULTIPLIER +
    (RARITY_MAXIMUM_MULTIPLIER - RARITY_MINIMUM_MULTIPLIER) * progress
  );
}

export function staticHazardChance(distanceFromOrigin: number): number {
  const distance = Math.max(0, distanceFromOrigin);
  if (distance <= 14) return 0;
  if (distance < 24) return 0.03;
  if (distance < 38) return 0.07;
  if (distance <= 52) return 0.11;
  return 0.14;
}

export function maximumActiveEnemies(distanceFromOrigin: number): number {
  const distance = Math.max(0, distanceFromOrigin);
  if (distance <= 14) return 0;
  if (distance < 24) return 1;
  if (distance < 38) return 2;
  if (distance <= 52) return 3;
  return 4;
}

/**
 * Distance changes a positive preference only. It receives no compatibility
 * mask and therefore cannot remove a legal tile or create a contradiction.
 */
export function applyDistanceWeight(
  baseWeight: number,
  distanceFromOrigin: number,
  rarityAffinity = 1,
): number {
  if (!Number.isFinite(baseWeight) || baseWeight <= 0) {
    throw new RangeError('baseWeight must be positive and finite');
  }
  const affinity = clamp01(rarityAffinity);
  const rareMultiplier = rarityMultiplier(distanceFromOrigin);
  const effectiveMultiplier = 1 + (rareMultiplier - 1) * affinity;
  return Math.max(Number.EPSILON, baseWeight * effectiveMultiplier);
}

export function applyDistanceWeights<T extends { readonly weight: number }>(
  candidates: readonly T[],
  distanceFromOrigin: number,
  rarityAffinity: (candidate: T) => number,
): readonly (T & { readonly effectiveWeight: number })[] {
  return candidates.map((candidate) => ({
    ...candidate,
    effectiveWeight: applyDistanceWeight(
      candidate.weight,
      distanceFromOrigin,
      rarityAffinity(candidate),
    ),
  }));
}
