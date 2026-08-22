/**
 * Validates that every "explore node" (a Tiled `ExploreNode`/`ExploreRandomNode`
 * object placed on a world map) resolves to an `Encounter`/`EncounterRandom`
 * (matched by name) whose `completionRewards` includes at least one
 * collectible drop. Ported from `scripts/validate-completionrewards.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  TiledMap,
} from '@interfaces';

const EXPLORE_NODE_LAYER_NAME = 'Explore Nodes';
const EXPLORE_NODE_TYPES = ['ExploreNode', 'ExploreRandomNode'];

function hasCollectibleReward(
  encounter: EncounterContent | EncounterRandomContent,
): boolean {
  return encounter.completionRewards.some((reward) => 'collectibleId' in reward);
}

export function runCompletionRewardsAnalysis(): AnalysisRunResult {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms = getEntriesByType<EncounterRandomContent>('encounterrandom');
  const encountersByName = new Map(encounters.map((e) => [e.name, e]));
  const encounterRandomsByName = new Map(encounterRandoms.map((e) => [e.name, e]));

  const checks: AnalysisCheck[] = [];
  let total = 0;

  allMaps().forEach((gameMap) => {
    const map = gameMap.data as TiledMap;
    const layer = map.layers.find((l) => l.name === EXPLORE_NODE_LAYER_NAME);
    if (!layer) return;

    const exploreNodes = (layer.objects ?? []).filter((object) =>
      EXPLORE_NODE_TYPES.includes(object.type),
    );

    exploreNodes.forEach((node) => {
      total += 1;
      const encounter = encountersByName.get(node.name) ?? encounterRandomsByName.get(node.name);
      const id = `${gameMap.name}:${node.name}`;

      if (encounter && hasCollectibleReward(encounter)) {
        checks.push({
          id,
          label: node.name,
          status: 'pass',
          message: `"${node.name}" on "${gameMap.name}" (${node.x}, ${node.y}) has a collectible completion reward.`,
        });
        return;
      }

      const reason = encounter
        ? 'its encounter has NO collectible completion reward'
        : 'there is NO matching Encounter or EncounterRandom';
      checks.push({
        id,
        label: node.name,
        status: 'fail',
        message: `Explore node "${node.name}" on map "${gameMap.name}" (tile x=${node.x}, y=${node.y}): ${reason}. Add a collectibleId reward to gamedata/encounter/*.yml or gamedata/encounterrandom/*.yml, then rerun "npm run gamedata:build".`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every explore node (${total} checked) has a collectible completion reward.`
        : `${failures} of ${total} explore node(s) are missing a collectible completion reward.`,
  };
}
