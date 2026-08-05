import {
  CARDINAL_DIRECTIONS,
  type Direction,
  type SocketId,
  type TerrainTileDefinition,
} from '../contracts/tiles';

import {
  compileGrammar,
  oppositeDirection,
  type GrammarSource,
} from './grammar-compiler';

export type GrammarIssueCode =
  | 'ASSET_MISSING'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_NUMERIC_ID'
  | 'FEATURE_TAG_MISSING'
  | 'INVALID_ROTATION'
  | 'INVALID_WEIGHT'
  | 'LETHAL_IN_SAFE_RADIUS'
  | 'PACK_WITHOUT_OPEN_ADAPTER'
  | 'RECIPROCITY_MISSING'
  | 'SOCKET_WITHOUT_TWO_EXITS'
  | 'UNKNOWN_SOCKET'
  | 'VARIANT_COMPILATION';

export interface GrammarIssue {
  readonly code: GrammarIssueCode;
  readonly message: string;
  readonly path: readonly string[];
}

export interface GrammarValidationResult {
  readonly valid: boolean;
  readonly issues: readonly GrammarIssue[];
}

export function validateGrammar(
  source: GrammarSource,
  knownAssetPaths?: ReadonlySet<string>,
): GrammarValidationResult {
  const issues: GrammarIssue[] = [];
  validateUniqueDefinitions(source, issues);
  validateWeightsAndSafety(source, issues);
  validateSockets(source, issues);
  validateFeatureTags(source, issues);
  validateAssets(source, knownAssetPaths, issues);

  let grammar: ReturnType<typeof compileGrammar> | null = null;
  try {
    grammar = compileGrammar(source);
  } catch (error) {
    issues.push({
      code: 'VARIANT_COMPILATION',
      message:
        error instanceof Error ? error.message : 'Grammar compilation failed.',
      path: ['compile'],
    });
  }
  if (grammar !== null) {
    validateTwoExits(grammar.terrain, grammar.terrainCompatibility, issues);
    validatePackAdapters(source.terrain, source, issues);
  }

  return { valid: issues.length === 0, issues };
}

export function formatGrammarIssues(issues: readonly GrammarIssue[]): string {
  return issues
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.code}] ${issue.message}\n   Path: ${issue.path.join(' -> ')}`,
    )
    .join('\n');
}

function validateUniqueDefinitions(
  source: GrammarSource,
  issues: GrammarIssue[],
): void {
  for (const [layer, definitions] of [
    ['terrain', source.terrain],
    ['feature', source.features],
  ] as const) {
    const ids = new Set<string>();
    const numericIds = new Set<number>();
    for (const definition of definitions) {
      if (ids.has(definition.id)) {
        issues.push({
          code: 'DUPLICATE_ID',
          message: `${layer} id ${definition.id} is repeated.`,
          path: [layer, definition.id],
        });
      }
      if (numericIds.has(definition.numericId)) {
        issues.push({
          code: 'DUPLICATE_NUMERIC_ID',
          message: `${layer} numericId ${definition.numericId} is repeated by ${definition.id}.`,
          path: [layer, String(definition.numericId), definition.id],
        });
      }
      ids.add(definition.id);
      numericIds.add(definition.numericId);
    }
  }
}

function validateWeightsAndSafety(
  source: GrammarSource,
  issues: GrammarIssue[],
): void {
  for (const tile of source.terrain) {
    if (!Number.isFinite(tile.weight) || tile.weight <= 0) {
      issues.push({
        code: 'INVALID_WEIGHT',
        message: `${tile.id} has non-positive playable weight ${tile.weight}.`,
        path: [tile.id, 'weight'],
      });
    }
    for (const rotation of tile.rotationQuarterTurns) {
      if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) {
        issues.push({
          code: 'INVALID_ROTATION',
          message: `${tile.id} declares unknown quarter-turn ${rotation}.`,
          path: [tile.id, 'rotationQuarterTurns', String(rotation)],
        });
      }
    }
    if (tile.lethal && tile.tags.includes('safe')) {
      issues.push({
        code: 'LETHAL_IN_SAFE_RADIUS',
        message: `${tile.id} is both lethal and tagged safe.`,
        path: [tile.id, 'lethal', 'safe'],
      });
    }
  }
  for (const feature of source.features) {
    if (!Number.isFinite(feature.weight) || feature.weight <= 0) {
      issues.push({
        code: 'INVALID_WEIGHT',
        message: `${feature.id} has non-positive playable weight ${feature.weight}.`,
        path: [feature.id, 'weight'],
      });
    }
    if (feature.lethal && feature.minDistanceFromOrigin < 4) {
      issues.push({
        code: 'LETHAL_IN_SAFE_RADIUS',
        message: `${feature.id} is lethal at ${feature.minDistanceFromOrigin}m; lethal features require at least 4m.`,
        path: [feature.id, 'minDistanceFromOrigin'],
      });
    }
  }
}

function validateSockets(source: GrammarSource, issues: GrammarIssue[]): void {
  const sockets = source.socketCompatibility.sockets as Readonly<
    Record<string, readonly string[]>
  >;
  for (const tile of source.terrain) {
    for (const direction of CARDINAL_DIRECTIONS) {
      const socket = tile.sockets[direction];
      if (!(socket in sockets)) {
        issues.push({
          code: 'UNKNOWN_SOCKET',
          message: `${tile.id} direction ${direction} uses unknown socket ${socket}.`,
          path: [tile.id, direction, socket],
        });
      }
    }
  }
  for (const [socket, compatible] of Object.entries(sockets)) {
    for (const target of compatible) {
      if (!(target in sockets)) {
        issues.push({
          code: 'UNKNOWN_SOCKET',
          message: `Compatibility ${socket} -> ${target} references an unknown socket.`,
          path: ['socket-compatibility', socket, target],
        });
        continue;
      }
      if (!sockets[target]?.includes(socket)) {
        issues.push({
          code: 'RECIPROCITY_MISSING',
          message: `${socket} accepts ${target}, but ${target} does not accept ${socket}.`,
          path: ['socket-compatibility', socket, target, socket],
        });
      }
    }
  }
}

function validateFeatureTags(
  source: GrammarSource,
  issues: GrammarIssue[],
): void {
  const terrainTags = new Set(source.terrain.flatMap((tile) => tile.tags));
  for (const feature of source.features) {
    for (const tag of feature.allowedTerrainTags) {
      if (terrainTags.has(tag)) continue;
      issues.push({
        code: 'FEATURE_TAG_MISSING',
        message: `${feature.id} requires terrain tag ${tag}, but no terrain defines it.`,
        path: [feature.id, 'allowedTerrainTags', tag],
      });
    }
  }
}

function validateAssets(
  source: GrammarSource,
  knownAssetPaths: ReadonlySet<string> | undefined,
  issues: GrammarIssue[],
): void {
  if (knownAssetPaths === undefined) return;
  for (const definition of [...source.terrain, ...source.features]) {
    if (definition.mesh === null || knownAssetPaths.has(definition.mesh))
      continue;
    issues.push({
      code: 'ASSET_MISSING',
      message: `${definition.id} references missing asset ${definition.mesh}.`,
      path: [definition.id, 'mesh', definition.mesh],
    });
  }
}

function validateTwoExits(
  variants: ReturnType<typeof compileGrammar>['terrain'],
  tables: ReturnType<typeof compileGrammar>['terrainCompatibility'],
  issues: GrammarIssue[],
): void {
  for (const variant of variants) {
    for (const direction of CARDINAL_DIRECTIONS) {
      const mask = tables[direction][variant.variantId];
      const exits =
        mask === undefined ? 0 : popcount(mask.lo) + popcount(mask.hi);
      if (exits >= 2) continue;
      issues.push({
        code: 'SOCKET_WITHOUT_TWO_EXITS',
        message: `${variant.id} direction ${direction} (${variant.sockets[direction]}) has ${exits} compatible terrain variant(s); at least 2 are required.`,
        path: [
          variant.id,
          direction,
          variant.sockets[direction],
          `exits:${exits}`,
        ],
      });
    }
  }
}

function validatePackAdapters(
  terrain: readonly TerrainTileDefinition[],
  source: GrammarSource,
  issues: GrammarIssue[],
): void {
  const packs = new Set(
    terrain.map((tile) => tile.packId).filter((pack) => pack !== 'base'),
  );
  const graph = buildSocketGraph(terrain, source);
  for (const pack of packs) {
    const starts = terrain
      .filter((tile) => tile.packId === pack)
      .flatMap((tile) =>
        CARDINAL_DIRECTIONS.map((direction) => ({
          tile: tile.id,
          direction,
          socket: tile.sockets[direction],
        })),
      );
    const successful = starts.some(
      (start) => shortestSocketPath(start.socket, 'OPEN_FLAT', graph).reached,
    );
    if (successful) continue;
    const first = starts[0];
    const unresolved = first
      ? shortestSocketPath(first.socket, 'OPEN_FLAT', graph).path
      : [];
    issues.push({
      code: 'PACK_WITHOUT_OPEN_ADAPTER',
      message: `Pack ${pack} has no transition to OPEN_FLAT. Shortest unresolved path: ${first?.tile ?? pack} direction ${first?.direction ?? 'N'} -> ${unresolved.join(' -> ')}.`,
      path: [
        pack,
        first?.tile ?? 'empty-pack',
        first?.direction ?? 'N',
        ...unresolved,
      ],
    });
  }
}

function buildSocketGraph(
  terrain: readonly TerrainTileDefinition[],
  source: GrammarSource,
): ReadonlyMap<string, ReadonlySet<string>> {
  const graph = new Map<string, Set<string>>();
  const connect = (from: string, to: string): void => {
    const neighbors = graph.get(from) ?? new Set<string>();
    neighbors.add(to);
    graph.set(from, neighbors);
  };
  for (const [socket, compatible] of Object.entries(
    source.socketCompatibility.sockets,
  )) {
    for (const target of compatible) connect(socket, target);
  }
  for (const tile of terrain) {
    const tileSockets = CARDINAL_DIRECTIONS.map(
      (direction) => tile.sockets[direction],
    );
    for (const from of tileSockets)
      for (const to of tileSockets) connect(from, to);
  }
  return graph;
}

function shortestSocketPath(
  start: SocketId,
  target: SocketId,
  graph: ReadonlyMap<string, ReadonlySet<string>>,
): { readonly reached: boolean; readonly path: readonly string[] } {
  const queue: string[][] = [[start]];
  const visited = new Set<string>([start]);
  let shortestDeadEnd: string[] = [start];
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) break;
    const current = path.at(-1);
    if (current === target) return { reached: true, path };
    const neighbors = current === undefined ? undefined : graph.get(current);
    if (neighbors === undefined || neighbors.size === 0) {
      if (path.length < shortestDeadEnd.length) shortestDeadEnd = path;
      continue;
    }
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
  return { reached: false, path: shortestDeadEnd };
}

function popcount(value: number): number {
  let bits = value >>> 0;
  let count = 0;
  while (bits !== 0) {
    bits &= bits - 1;
    count += 1;
  }
  return count;
}

export function compatibleDirectionLabel(direction: Direction): string {
  return `${direction}/${oppositeDirection(direction)}`;
}
