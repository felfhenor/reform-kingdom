/**
 * Validates that every `TeleportNode` object placed on the world maps has a
 * `tag`/`toTag` property, that no two `TeleportNode`s share a `tag`, and
 * that every `toTag` resolves to a `tag` that exists somewhere across the
 * maps. Ported from `scripts/validate-teleportnodes.ts`.
 */

import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  TeleportNodeCheckRef,
  TiledMap,
  TiledObject,
} from '@interfaces';

const TELEPORT_NODE_TYPE = 'TeleportNode';

function propertyValue(object: TiledObject, propertyName: string): string | undefined {
  const property = (object.properties ?? []).find((p) => p.name === propertyName);
  if (typeof property?.value !== 'string' || property.value.trim() === '') {
    return undefined;
  }
  return property.value;
}

export function runTeleportNodesAnalysis(): AnalysisRunResult {
  const checks: AnalysisCheck[] = [];
  const allTeleportNodes: TeleportNodeCheckRef[] = [];
  const tagOwners = new Map<string, TeleportNodeCheckRef>();

  allMaps().forEach((gameMap) => {
    const map = gameMap.data as TiledMap;
    const teleportNodes = map.layers.flatMap((layer) =>
      (layer.objects ?? []).filter((object) => object.type === TELEPORT_NODE_TYPE),
    );

    teleportNodes.forEach((node) => {
      const ref: TeleportNodeCheckRef = {
        mapName: gameMap.name,
        nodeName: node.name,
        tag: propertyValue(node, 'tag'),
        toTag: propertyValue(node, 'toTag'),
      };
      allTeleportNodes.push(ref);
      let hadProblem = false;

      if (!ref.tag || !ref.toTag) {
        checks.push({
          id: `${gameMap.name}:${node.name}:props`,
          label: node.name,
          status: 'fail',
          message: `Teleport node "${node.name}" on map "${gameMap.name}" is missing a ${!ref.tag ? '"tag"' : '"toTag"'} property.`,
        });
        hadProblem = true;
      }

      if (ref.tag) {
        const existingOwner = tagOwners.get(ref.tag);
        if (existingOwner) {
          checks.push({
            id: `${gameMap.name}:${node.name}:dupe-tag`,
            label: node.name,
            status: 'fail',
            message: `Teleport node "${node.name}" on map "${gameMap.name}" has tag "${ref.tag}", already used by "${existingOwner.nodeName}" on "${existingOwner.mapName}". Tags must be unique.`,
          });
          hadProblem = true;
        } else {
          tagOwners.set(ref.tag, ref);
        }
      }

      if (!hadProblem) {
        checks.push({
          id: `${gameMap.name}:${node.name}:ok`,
          label: node.name,
          status: 'pass',
          message: `"${node.name}" on "${gameMap.name}" -> tag="${ref.tag}", toTag="${ref.toTag}".`,
        });
      }
    });
  });

  allTeleportNodes
    .filter((ref) => ref.toTag && !tagOwners.has(ref.toTag))
    .forEach((ref) => {
      checks.push({
        id: `${ref.mapName}:${ref.nodeName}:unresolved-totag`,
        label: ref.nodeName,
        status: 'fail',
        message: `Teleport node "${ref.nodeName}" on map "${ref.mapName}" has toTag "${ref.toTag}", which does not match any teleport node's "tag".`,
      });
    });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every teleport node (${allTeleportNodes.length} checked, ${tagOwners.size} unique tag(s)) is valid.`
        : `${failures} problem(s) found across ${allTeleportNodes.length} teleport node(s).`,
  };
}
