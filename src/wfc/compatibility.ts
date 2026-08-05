import type { Direction } from '../contracts/tiles';
import type { DomainMask } from '../contracts/world';

import { DOMAIN_CAPACITY, createEmptyMask, hasBit, setBit } from './bitset';

export const CARDINAL_DIRECTIONS = ['N', 'E', 'S', 'W'] as const;

export const OPPOSITE_DIRECTION: Readonly<Record<Direction, Direction>> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export interface CardinalVariantDefinition {
  readonly id: string;
  readonly sockets: Readonly<Record<Direction, string>>;
}

export type SocketCompatibility = Readonly<Record<string, readonly string[]>>;

/** Allowed target variants for every source variant and direction. */
export type CardinalCompatibilityTable = Readonly<
  Record<Direction, readonly DomainMask[]>
>;

/**
 * Compiles socket compatibility into 64-bit masks used by propagation.
 * Socket rules are required to be reciprocal before any table is returned.
 */
export function compileCardinalCompatibility(
  variants: readonly CardinalVariantDefinition[],
  socketCompatibility: SocketCompatibility,
): CardinalCompatibilityTable {
  assertVariants(variants);
  const compatibleSocketSets = compileSocketSets(variants, socketCompatibility);
  const table: Record<Direction, DomainMask[]> = {
    N: [],
    E: [],
    S: [],
    W: [],
  };

  for (const direction of CARDINAL_DIRECTIONS) {
    for (const source of variants) {
      const allowed = createEmptyMask();
      const compatibleSockets = compatibleSocketSets.get(
        source.sockets[direction],
      );
      if (compatibleSockets === undefined) {
        throw new RangeError(
          `missing compatibility for socket ${source.sockets[direction]}`,
        );
      }

      const opposite = OPPOSITE_DIRECTION[direction];
      for (
        let targetIndex = 0;
        targetIndex < variants.length;
        targetIndex += 1
      ) {
        const target = variants[targetIndex];
        if (
          target !== undefined &&
          compatibleSockets.has(target.sockets[opposite])
        ) {
          setBit(allowed, targetIndex);
        }
      }
      table[direction].push(allowed);
    }
  }

  assertDirectionalReciprocity(table, variants);
  return table;
}

function compileSocketSets(
  variants: readonly CardinalVariantDefinition[],
  socketCompatibility: SocketCompatibility,
): ReadonlyMap<string, ReadonlySet<string>> {
  const usedSockets = new Set<string>();
  for (const variant of variants) {
    for (const direction of CARDINAL_DIRECTIONS) {
      usedSockets.add(variant.sockets[direction]);
    }
  }

  const compatibleSocketSets = new Map<string, ReadonlySet<string>>();
  for (const socket of usedSockets) {
    const targets = socketCompatibility[socket];
    if (targets === undefined) {
      throw new RangeError(`missing compatibility for socket ${socket}`);
    }

    const targetSet = new Set(targets);
    if (targetSet.size !== targets.length) {
      throw new RangeError(`socket ${socket} repeats a compatible socket`);
    }
    for (const target of targetSet) {
      if (!usedSockets.has(target)) {
        throw new RangeError(
          `socket ${socket} references unknown compatible socket ${target}`,
        );
      }
    }
    compatibleSocketSets.set(socket, targetSet);
  }

  for (const [socket, targets] of compatibleSocketSets) {
    for (const target of targets) {
      if (!compatibleSocketSets.get(target)?.has(socket)) {
        throw new RangeError(
          `socket compatibility is not reciprocal: ${socket} -> ${target}`,
        );
      }
    }
  }
  return compatibleSocketSets;
}

function assertVariants(variants: readonly CardinalVariantDefinition[]): void {
  if (variants.length === 0 || variants.length > DOMAIN_CAPACITY) {
    throw new RangeError('variant count must be between 1 and 64');
  }

  const ids = new Set<string>();
  for (const variant of variants) {
    if (variant.id.length === 0 || ids.has(variant.id)) {
      throw new RangeError(
        `variant id must be non-empty and unique: ${variant.id}`,
      );
    }
    ids.add(variant.id);
    for (const direction of CARDINAL_DIRECTIONS) {
      if (variant.sockets[direction].length === 0) {
        throw new RangeError(
          `variant ${variant.id} has an empty ${direction} socket`,
        );
      }
    }
  }
}

function assertDirectionalReciprocity(
  table: Readonly<Record<Direction, readonly DomainMask[]>>,
  variants: readonly CardinalVariantDefinition[],
): void {
  for (const direction of CARDINAL_DIRECTIONS) {
    const opposite = OPPOSITE_DIRECTION[direction];
    for (let source = 0; source < variants.length; source += 1) {
      const allowed = table[direction][source];
      if (allowed === undefined) {
        throw new RangeError(
          `missing ${direction} table for variant ${source}`,
        );
      }
      for (let target = 0; target < variants.length; target += 1) {
        if (hasBit(allowed, target)) {
          const reverse = table[opposite][target];
          if (reverse === undefined || !hasBit(reverse, source)) {
            throw new RangeError(
              `directional compatibility is not reciprocal: ${source} ${direction} ${target}`,
            );
          }
        }
      }
    }
  }
}
