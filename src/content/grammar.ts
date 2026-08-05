import type {
  FeatureTileDefinition,
  SocketCompatibilityDocument,
  TerrainTileDefinition,
} from '../contracts/tiles';

import featureJson from './features.tiles.json';
import { compileGrammar, type GrammarSource } from './grammar-compiler';
import socketJson from './socket-compatibility.json';
import terrainJson from './terrain.tiles.json';

export const GRAMMAR_SOURCE: GrammarSource = {
  terrain: terrainJson as TerrainTileDefinition[],
  features: featureJson as FeatureTileDefinition[],
  socketCompatibility: socketJson as SocketCompatibilityDocument,
};

export const COMPILED_GRAMMAR = compileGrammar(GRAMMAR_SOURCE);
