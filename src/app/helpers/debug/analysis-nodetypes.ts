/**
 * Validates that every node placed on the world maps has a recognized
 * `type`, and that a node backed by content uses the type that content
 * needs - an empty or misspelled type silently drops the node from the game.
 */

import { getEntry } from '@helpers/content/content';
import { isTiledWorldNodeType } from '@helpers/pixi/tiled-map';
import { worldNodeLookup } from '@helpers/world-node/world-nodes';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  ContentType,
  IsContentItem,
  MapNodeCheckRef,
  WorldNodeType,
} from '@interfaces';
import { WORLD_NODE_TYPES } from '@interfaces';

// nodeoverride is left out on purpose: it backs Kingdom and TeleportNode alike.
const NODE_TYPE_BY_CONTENT_TYPE: Partial<Record<ContentType, WorldNodeType>> = {
  encounter: 'ExploreNode',
  encounterrandom: 'ExploreRandomNode',
  gathering: 'GatherNode',
  caravan: 'CaravanNode',
  shrine: 'Shrine',
  outpost: 'Outpost',
  trainer: 'Trainer',
  exchangenode: 'ExchangeNode',
  town: 'NonPlayerKingdom',
  collectiblegate: 'CollectibleGate',
};

function expectedNodeType(nodeName: string): WorldNodeType | undefined {
  const content = getEntry<IsContentItem>(nodeName);
  return content ? NODE_TYPE_BY_CONTENT_TYPE[content.__type] : undefined;
}

// Content match first; otherwise a valid type that contains (or is contained by) the typo, e.g. "Teleport".
function suggestedNodeType(ref: MapNodeCheckRef): WorldNodeType | undefined {
  const expected = expectedNodeType(ref.node.name);
  if (expected) return expected;

  const type = ref.node.type.toLowerCase();
  if (type === '') return undefined;

  return WORLD_NODE_TYPES.find((validType) => {
    const valid = validType.toLowerCase();
    return valid.includes(type) || type.includes(valid);
  });
}

function nodeTypeProblem(ref: MapNodeCheckRef): string | undefined {
  const { node } = ref;
  const suggestion = suggestedNodeType(ref);
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';

  if (node.type === '') return `has no type.${hint}`;
  if (!isTiledWorldNodeType(node.type)) {
    return `has unknown type "${node.type}".${hint}`;
  }

  const expected = expectedNodeType(node.name);
  if (expected && expected !== node.type) {
    return `is typed "${node.type}", but its content needs "${expected}".`;
  }

  return undefined;
}

function checkNodeType(ref: MapNodeCheckRef): AnalysisCheck {
  const { mapName, node } = ref;
  const id = `${mapName}:${node.name}:${node.id}`;
  const problem = nodeTypeProblem(ref);

  return problem
    ? {
        id,
        label: node.name,
        status: 'fail',
        message: `Node "${node.name}" on map "${mapName}" (object id ${node.id}) ${problem}`,
      }
    : {
        id,
        label: node.name,
        status: 'pass',
        message: `"${node.name}" on "${mapName}" is a valid ${node.type}.`,
      };
}

export function runNodeTypesAnalysis(): AnalysisRunResult {
  // Name-keyed, so a duplicated name is checked once; validate:nodenames fails those.
  const refs: MapNodeCheckRef[] = Object.values(worldNodeLookup().byName).map(
    (entry) => ({ mapName: entry.mapName, node: entry.nodeData }),
  );

  const checks = refs.map(checkNodeType);
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every node (${refs.length} checked) has a valid type that matches its content.`
        : `${failures} of ${refs.length} node(s) have a missing, unknown, or mismatched type.`,
  };
}
