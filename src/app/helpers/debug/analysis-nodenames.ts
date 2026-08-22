/**
 * Validates that every node object placed on the world maps (on the
 * "Explore Nodes" or "Other Nodes" layers) has a name that's unique across
 * *all* maps, regardless of node type - see `worldNodeMapsBuild` in
 * `src/app/helpers/world-nodes.ts`, which indexes nodes into one flat
 * `byName` map with no scoping. Ported from `scripts/validate-nodenames.ts`.
 */

import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  MapNodeCheckRef,
  TiledMap,
} from '@interfaces';

const NODE_LAYER_NAMES = ['Explore Nodes', 'Other Nodes'];

export function runNodeNamesAnalysis(): AnalysisRunResult {
  const checks: AnalysisCheck[] = [];
  const nameOwners = new Map<string, MapNodeCheckRef>();
  let total = 0;

  allMaps().forEach((gameMap) => {
    const map = gameMap.data as TiledMap;
    const nodes = map.layers
      .filter((layer) => NODE_LAYER_NAMES.includes(layer.name))
      .flatMap((layer) => layer.objects ?? []);

    nodes.forEach((node) => {
      total += 1;
      const existingOwner = nameOwners.get(node.name);

      if (existingOwner) {
        checks.push({
          id: `${gameMap.name}:${node.name}:${node.id}`,
          label: node.name,
          status: 'fail',
          message: `Node "${node.name}" (${node.type}) on map "${gameMap.name}" shares its name with "${existingOwner.node.name}" (${existingOwner.node.type}) on map "${existingOwner.mapName}". Node names must be unique across every map.`,
        });
        return;
      }

      nameOwners.set(node.name, { mapName: gameMap.name, node });
      checks.push({
        id: `${gameMap.name}:${node.name}:${node.id}`,
        label: node.name,
        status: 'pass',
        message: `"${node.name}" (${node.type}) on "${gameMap.name}" is unique.`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every node name (${total} checked, ${nameOwners.size} unique) is unique across all maps.`
        : `${failures} node name collision(s) found across ${total} node(s).`,
  };
}
