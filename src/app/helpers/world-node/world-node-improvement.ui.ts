import { travelEtaSecondsTo } from '@helpers/hero/travel';
import { travelCanStartTo } from '@helpers/hero/travel.ui';
import { regionNameForMap } from '@helpers/lore/region-intro';
import { isPartyAtNode } from '@helpers/world';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
} from '@helpers/world-node/world-node-development';
import {
  WORLD_NODE_DEVELOPABLE_TYPES,
  worldNodeDevelopable,
  worldNodeDevelopmentLevel,
  worldNodeDevelopmentTimerText,
} from '@helpers/world-node/world-node-development-state';
import { isWorldNodeVisited } from '@helpers/world-node/world-node-visit';
import {
  isWorldNodeVisible,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  WorldNodeEntry,
  WorldNodeImprovementRowViewModel,
} from '@interfaces';
import { WORLD_NODE_TYPE_BY_CONTENT_TYPE } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function worldNodeImprovementRow(
  entry: WorldNodeEntry,
): WorldNodeImprovementRowViewModel[] {
  const content = worldNodeDevelopable(entry.nodeName);
  const level = worldNodeDevelopmentLevel(entry.nodeName);
  if (!content || worldNodeDevelopmentIsMaxLevel(content, level)) return [];

  return [
    {
      node: entry,
      regionName: regionNameForMap(entry.mapName),
      level,
      costs: worldNodeDevelopmentLevelUpCost(content, level),
      developingTimerText: worldNodeDevelopmentTimerText(entry.nodeName),
      isPartyHere: isPartyAtNode(entry.nodeName),
      canTravel: travelCanStartTo(entry),
      travelEtaSeconds: travelEtaSecondsTo(entry.nodeName),
    },
  ];
}

function worldNodesVisitedDevelopable(): WorldNodeEntry[] {
  return WORLD_NODE_DEVELOPABLE_TYPES.flatMap((type) =>
    worldNodesOfType(WORLD_NODE_TYPE_BY_CONTENT_TYPE[type]),
  ).filter(
    (entry) => isWorldNodeVisited(entry.nodeName) && isWorldNodeVisible(entry),
  );
}

export function worldNodeImprovementRows(): WorldNodeImprovementRowViewModel[] {
  return sortBy(
    worldNodesVisitedDevelopable().flatMap(worldNodeImprovementRow),
    [(row) => row.regionName, (row) => row.node.nodeName],
  );
}
