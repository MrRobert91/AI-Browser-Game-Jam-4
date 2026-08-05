import {
  CARDINAL_DIRECTIONS,
  type CompiledFeatureVariant,
  type CompiledGrammar,
  type CompiledTerrainVariant,
  type Direction,
  type FeatureTileDefinition,
  type SocketCompatibilityDocument,
  type SocketId,
  type TerrainTileDefinition,
} from '../contracts/tiles';

export const MAX_VARIANTS_PER_LAYER = 64;

const DIRECTION_INDEX: Readonly<Record<Direction, number>> = {
  N: 0,
  E: 1,
  S: 2,
  W: 3,
};

export interface GrammarSource {
  readonly terrain: readonly TerrainTileDefinition[];
  readonly features: readonly FeatureTileDefinition[];
  readonly socketCompatibility: SocketCompatibilityDocument;
}

export function compileGrammar(source: GrammarSource): CompiledGrammar {
  const terrain = compileTerrainVariants(source.terrain);
  const features = source.features.map<CompiledFeatureVariant>(
    (definition, variantId) => ({
      variantId,
      definitionNumericId: definition.numericId,
      id: definition.id,
      packId: definition.packId,
      weight: definition.weight,
      mesh: definition.mesh,
      tags: definition.tags,
      allowedTerrainTags: definition.allowedTerrainTags,
      minDistanceFromOrigin: definition.minDistanceFromOrigin,
      maxSlopeDegrees: definition.maxSlopeDegrees,
      blocksMovement: definition.blocksMovement,
      lethal: definition.lethal,
    }),
  );

  assertLayerLimit('terrain', terrain.length);
  assertLayerLimit('feature', features.length);

  return {
    terrain,
    features,
    terrainCompatibility: buildTerrainCompatibility(
      terrain,
      source.socketCompatibility,
    ),
  };
}

export function compileTerrainVariants(
  definitions: readonly TerrainTileDefinition[],
): readonly CompiledTerrainVariant[] {
  const variants: CompiledTerrainVariant[] = [];
  for (const definition of definitions) {
    const signatures = new Set<string>();
    for (const rotation of definition.rotationQuarterTurns) {
      const sockets = rotateSockets(definition.sockets, rotation);
      const signature = CARDINAL_DIRECTIONS.map(
        (direction) => sockets[direction],
      ).join('|');
      if (signatures.has(signature)) {
        throw new Error(
          `Tile ${definition.id} declares duplicate rotation ${rotation}; socket signature ${signature} already exists.`,
        );
      }
      signatures.add(signature);
      variants.push({
        variantId: variants.length,
        definitionNumericId: definition.numericId,
        id: `${definition.id}@${rotation}`,
        packId: definition.packId,
        rotationQuarterTurns: rotation,
        weight: definition.weight,
        mesh: definition.mesh,
        sockets,
        tags: definition.tags,
        walkable: definition.walkable,
        lethal: definition.lethal,
        heightClass: definition.heightClass,
        fallbackRank: definition.fallbackRank,
      });
    }
  }
  assertLayerLimit('terrain', variants.length);
  return variants;
}

export function rotateSockets(
  sockets: Readonly<Record<Direction, SocketId>>,
  quarterTurns: 0 | 1 | 2 | 3,
): Readonly<Record<Direction, SocketId>> {
  const rotated = {} as Record<Direction, SocketId>;
  for (const direction of CARDINAL_DIRECTIONS) {
    const sourceIndex = (DIRECTION_INDEX[direction] - quarterTurns + 4) % 4;
    const sourceDirection = CARDINAL_DIRECTIONS[sourceIndex];
    if (sourceDirection === undefined)
      throw new Error('Invalid cardinal rotation');
    rotated[direction] = sockets[sourceDirection];
  }
  return rotated;
}

function buildTerrainCompatibility(
  variants: readonly CompiledTerrainVariant[],
  document: SocketCompatibilityDocument,
): CompiledGrammar['terrainCompatibility'] {
  const tables = {} as Record<
    Direction,
    Readonly<{ lo: number; hi: number }>[]
  >;
  for (const direction of CARDINAL_DIRECTIONS) {
    const opposite = oppositeDirection(direction);
    tables[direction] = variants.map((variant) => {
      const compatibleSockets = document.sockets[variant.sockets[direction]];
      let lo = 0;
      let hi = 0;
      variants.forEach((candidate, candidateId) => {
        if (!compatibleSockets.includes(candidate.sockets[opposite])) return;
        if (candidateId < 32) lo = (lo | (1 << candidateId)) >>> 0;
        else hi = (hi | (1 << (candidateId - 32))) >>> 0;
      });
      return { lo, hi };
    });
  }
  return tables;
}

export function oppositeDirection(direction: Direction): Direction {
  return CARDINAL_DIRECTIONS[(DIRECTION_INDEX[direction] + 2) % 4] ?? 'N';
}

function assertLayerLimit(layer: string, count: number): void {
  if (count > MAX_VARIANTS_PER_LAYER) {
    throw new Error(
      `${layer} layer compiles to ${count} variants; maximum is 64.`,
    );
  }
}
