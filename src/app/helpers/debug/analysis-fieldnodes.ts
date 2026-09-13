/**
 * Validates that every "field node" (a Tiled `ExploreNode`, `ExploreRandomNode`,
 * `GatherNode`, or `Shrine` object placed on a world map) has a matching
 * `Encounter`, `EncounterRandom`, `Gathering`, or `Shrine` content entry,
 * matched by name.
 */

import { getEntriesByType } from '@helpers/content/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  ShrineContent,
  TiledMap,
} from '@interfaces';

const FIELD_NODE_LAYER_NAME = 'Explore Nodes';
const FIELD_NODE_TYPES = [
  'ExploreNode',
  'ExploreRandomNode',
  'GatherNode',
  'Shrine',
];

export function runFieldNodesAnalysis(): AnalysisRunResult {
  const encounterNames = new Set(
    getEntriesByType<EncounterContent>('encounter').map((e) => e.name),
  );
  const encounterRandomNames = new Set(
    getEntriesByType<EncounterRandomContent>('encounterrandom').map(
      (e) => e.name,
    ),
  );
  const gatheringNames = new Set(
    getEntriesByType<GatheringContent>('gathering').map((g) => g.name),
  );
  const shrineNames = new Set(
    getEntriesByType<ShrineContent>('shrine').map((s) => s.name),
  );
  const nodeNames = new Set([
    ...encounterNames,
    ...encounterRandomNames,
    ...gatheringNames,
    ...shrineNames,
  ]);

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
        let kind = 'gathering';
        if (encounterNames.has(node.name)) kind = 'encounter';
        if (encounterRandomNames.has(node.name)) kind = 'random encounter';
        if (shrineNames.has(node.name)) kind = 'shrine';

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
        message: `Field node "${node.name}" on map "${gameMap.name}" (tile x=${node.x}, y=${node.y}) has no Encounter, EncounterRandom, Gathering, or Shrine entry whose "name" is "${node.name}". Add one, then rerun "npm run gamedata:build".`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every field node (${total} checked) has a corresponding content entry.`
        : `${failures} of ${total} field node(s) have no matching encounter, random encounter, gathering, or shrine entry.`,
  };
}
