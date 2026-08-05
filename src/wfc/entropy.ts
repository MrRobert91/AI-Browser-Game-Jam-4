import type { DomainMask } from '../contracts/world';

import { nextSetBit } from './bitset';
import { nextFloat01, type RngState } from './rng';

export const EFFECTIVE_WEIGHT_NOISE_AMPLITUDE = 0.02;
export const PRIORITY_NOISE_AMPLITUDE = 0.000001;

export interface WeightDefinition {
  readonly weight: number;
  readonly distanceCurve?: readonly (readonly [number, number])[];
  readonly neighborBias?: Readonly<Record<string, number>>;
}

export interface EffectiveWeightContext {
  readonly distanceFromOrigin: number;
  readonly neighborTagCounts?: Readonly<Record<string, number>>;
  readonly progressionMultiplier?: number;
  readonly deterministicNoise01?: number;
  readonly deterministicNoiseByVariant?: readonly number[];
}

export interface ObservationPriorityCandidate {
  readonly cellId: number;
  readonly observationCharge: number;
  readonly boundaryContinuity: number;
  readonly normalizedEntropy: number;
  readonly deterministicNoise01: number;
  readonly eligible?: boolean;
}

/**
 * Computes the complete positive weight used by entropy and weighted choice.
 * Compatibility is deliberately absent: callers may only pass definitions
 * whose bits remain in the domain, so soft factors cannot restore a removed bit.
 */
export function effectiveWeight(
  definition: WeightDefinition,
  context: EffectiveWeightContext,
): number {
  return effectiveWeightWithNoise(
    definition,
    context,
    context.deterministicNoise01 ?? 0.5,
  );
}

function effectiveWeightWithNoise(
  definition: WeightDefinition,
  context: EffectiveWeightContext,
  deterministicNoise01: number,
): number {
  const baseWeight = assertPositiveFinite(definition.weight, 'weight');
  const distanceFromOrigin = assertNonNegativeFinite(
    context.distanceFromOrigin,
    'distanceFromOrigin',
  );
  const progressionMultiplier = assertPositiveFinite(
    context.progressionMultiplier ?? 1,
    'progressionMultiplier',
  );
  const noise01 = assertUnitInterval(
    deterministicNoise01,
    'deterministicNoise01',
  );

  let neighborMultiplier = 1;
  if (definition.neighborBias !== undefined) {
    for (const tag in definition.neighborBias) {
      const bias = assertPositiveFinite(
        definition.neighborBias[tag],
        `neighborBias.${tag}`,
      );
      const count = context.neighborTagCounts?.[tag] ?? 0;
      if (!Number.isInteger(count) || count < 0) {
        throw new RangeError(
          `neighborTagCounts.${tag} must be a non-negative integer`,
        );
      }
      neighborMultiplier *= bias ** count;
    }
  }

  const noiseMultiplier =
    1 + (noise01 * 2 - 1) * EFFECTIVE_WEIGHT_NOISE_AMPLITUDE;
  const result =
    baseWeight *
    interpolateDistanceCurve(definition.distanceCurve, distanceFromOrigin) *
    neighborMultiplier *
    progressionMultiplier *
    noiseMultiplier;

  return assertPositiveFinite(result, 'effectiveWeight');
}

/** Shannon entropy over the currently legal domain, using natural logarithms. */
export function weightedEntropy(
  domain: DomainMask,
  definitions: readonly WeightDefinition[],
  context: EffectiveWeightContext,
): number {
  let sumWeights = 0;
  let sumWeightedLogs = 0;
  let candidateCount = 0;

  for (
    let variant = nextSetBit(domain);
    variant !== -1;
    variant = nextSetBit(domain, variant + 1)
  ) {
    const weight = weightForVariant(variant, definitions, context);
    sumWeights += weight;
    sumWeightedLogs += weight * Math.log(weight);
    candidateCount += 1;
  }

  if (candidateCount === 0) {
    throw new RangeError('weighted entropy is undefined for an empty domain');
  }

  if (!Number.isFinite(sumWeights) || !Number.isFinite(sumWeightedLogs)) {
    throw new RangeError('weighted entropy overflowed its finite range');
  }

  return Math.max(0, Math.log(sumWeights) - sumWeightedLogs / sumWeights);
}

/**
 * Selects only among legal bits, in ascending bit order, with a deterministic
 * PRNG stream. Invalid weights are rejected before consuming the stream.
 */
export function selectWeightedVariant(
  domain: DomainMask,
  definitions: readonly WeightDefinition[],
  context: EffectiveWeightContext,
  rng: RngState,
): number | null {
  let totalWeight = 0;
  let lastVariant = -1;

  for (
    let variant = nextSetBit(domain);
    variant !== -1;
    variant = nextSetBit(domain, variant + 1)
  ) {
    totalWeight += weightForVariant(variant, definitions, context);
    lastVariant = variant;
  }

  if (lastVariant === -1) {
    return null;
  }
  if (!Number.isFinite(totalWeight)) {
    throw new RangeError('total effective weight overflowed its finite range');
  }

  let remaining = nextFloat01(rng) * totalWeight;
  for (
    let variant = nextSetBit(domain);
    variant !== -1;
    variant = nextSetBit(domain, variant + 1)
  ) {
    remaining -= weightForVariant(variant, definitions, context);
    if (remaining < 0) {
      return variant;
    }
  }

  return lastVariant;
}

export function observationPriority(
  candidate: ObservationPriorityCandidate,
): number {
  assertCellId(candidate.cellId);
  const charge = assertUnitInterval(
    candidate.observationCharge,
    'observationCharge',
  );
  const continuity = assertUnitInterval(
    candidate.boundaryContinuity,
    'boundaryContinuity',
  );
  const entropy = assertUnitInterval(
    candidate.normalizedEntropy,
    'normalizedEntropy',
  );
  const noise01 = assertUnitInterval(
    candidate.deterministicNoise01,
    'deterministicNoise01',
  );
  const noise = (noise01 * 2 - 1) * PRIORITY_NOISE_AMPLITUDE;

  return 4 * charge + 1.5 * continuity - 0.8 * entropy + noise;
}

/** Highest priority wins; exact ties fall back to the lowest stable cell id. */
export function selectHighestPriorityCell(
  candidates: readonly ObservationPriorityCandidate[],
): ObservationPriorityCandidate | null {
  let selected: ObservationPriorityCandidate | null = null;
  let selectedPriority = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.eligible === false) {
      continue;
    }

    const priority = observationPriority(candidate);
    if (
      selected === null ||
      priority > selectedPriority ||
      (priority === selectedPriority && candidate.cellId < selected.cellId)
    ) {
      selected = candidate;
      selectedPriority = priority;
    }
  }

  return selected;
}

function weightForVariant(
  variant: number,
  definitions: readonly WeightDefinition[],
  context: EffectiveWeightContext,
): number {
  const definition = definitions[variant];
  if (definition === undefined) {
    throw new RangeError(
      `missing weight definition for enabled variant ${variant}`,
    );
  }
  return effectiveWeightWithNoise(
    definition,
    context,
    context.deterministicNoiseByVariant?.[variant] ??
      context.deterministicNoise01 ??
      0.5,
  );
}

function interpolateDistanceCurve(
  curve: WeightDefinition['distanceCurve'],
  distance: number,
): number {
  if (curve === undefined || curve.length === 0) {
    return 1;
  }

  let previousDistance = -1;
  for (const [pointDistance, multiplier] of curve) {
    assertNonNegativeFinite(pointDistance, 'distanceCurve distance');
    assertPositiveFinite(multiplier, 'distanceCurve multiplier');
    if (pointDistance <= previousDistance) {
      throw new RangeError(
        'distanceCurve distances must be strictly increasing',
      );
    }
    previousDistance = pointDistance;
  }

  const first = curve[0];
  const last = curve[curve.length - 1];
  if (first === undefined || last === undefined) {
    return 1;
  }
  if (distance <= first[0]) {
    return first[1];
  }
  if (distance >= last[0]) {
    return last[1];
  }

  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index];
    const left = curve[index - 1];
    if (right !== undefined && left !== undefined && distance <= right[0]) {
      const position = (distance - left[0]) / (right[0] - left[0]);
      return left[1] + (right[1] - left[1]) * position;
    }
  }

  return last[1];
}

function assertPositiveFinite(value: number | undefined, name: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

function assertNonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
  return value;
}

function assertUnitInterval(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
  return value;
}

function assertCellId(cellId: number): void {
  if (!Number.isInteger(cellId) || cellId < 0 || cellId > 0xffffffff) {
    throw new RangeError('cellId must be a uint32');
  }
}
