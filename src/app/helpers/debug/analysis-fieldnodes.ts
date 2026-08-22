/**
 * Validates that every "field node" (a Tiled `ExploreNode`, `ExploreRandomNode`,
 * or `GatherNode` object placed on a world map) has a matching `Encounter`,
 * `EncounterRandom`, or `Gathering` content entry, matched by name. Ported
 * from `scripts/validate-fieldnodes.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  TiledMap,
} from '@interfaces';

const FIELD_NODE_LAYER_NAME = 'Explore Nodes';
const FIELD_NODE_TYPES = ['ExploreNode', 'ExploreRandomNode', 'GatherNode'];

export function runFieldNodesAnalysis(): AnalysisRunResult {
  const encounterNames = new Set(getEntriesByType<EncounterContent>('encounter').map((e) => e.name));
  const encounterRandomNames = new Set(
    getEntriesByType<EncounterRandomContent>('encounterrandom').map((e) => e.name),
  );
  const gatheringNames = new Set(getEntriesByType<GatheringContent>('gathering').map((g) => g.name));
  const nodeNames = new Set([...encounterNames, ...encounterRandomNames, ...gatheringNames]);

  const checks: AnalysisCheck[] = [];
  let total = 0;

  allMaps().forEach((gameMap) => {
    const map = gameMap.data as TiledMap;
    const layer = map.layers.find((l) => l.name === FIELD_NODE_LAYER_NAME);
    if (!layer) return;

    const fieldNodes = (layer.objects ?? []).filter((object) =>
      FIELD_NODE_TYPES.includes(object.type),
    );

    fieldNodes.forEach((node) => {
      total += 1;
      const id = `${gameMap.name}:${node.name}`;

      if (nodeNames.has(node.name)) {
        const kind = encounterNames.has(node.name)
          ? 'encounter'
          : encounterRandomNames.has(node.name)
            ? 'random encounter'
            : 'gathering';
        checks.push({
          id,
          label: node.name,
          status: 'pass',
          message: `"${node.name}" on "${gameMap.name}" (${node.x}, ${node.y}) matches ${kind} "${node.name}".`,
        });
        return;
      }

      checks.push({
        id,
        label: node.name,
        status: 'fail',
        message: `Field node "${node.name}" on map "${gameMap.name}" (tile x=${node.x}, y=${node.y}) has no Encounter, EncounterRandom, or Gathering entry whose "name" is "${node.name}". Add one, then rerun "npm run gamedata:build".`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every field node (${total} checked) has a corresponding content entry.`
        : `${failures} of ${total} field node(s) have no matching encounter, random encounter, or gathering node.`,
  };
}
