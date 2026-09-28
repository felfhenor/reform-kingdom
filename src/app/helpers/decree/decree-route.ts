import {
  travelPathThroughNodesTo,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding-travel';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type { DecreeRoute, TravelStep, WorldNodeEntry } from '@interfaces';

// Walking onto a TeleportNode right before its jump, or landing on one, is using it rather than crossing it.
function isCrossingStep(path: TravelStep[], index: number): boolean {
  return path[index].kind === 'Move' && path[index + 1]?.kind !== 'Teleport';
}

export function firstCrossedNode(
  path: TravelStep[],
): WorldNodeEntry | undefined {
  for (let index = 0; index < path.length - 1; index++) {
    if (!isCrossingStep(path, index)) continue;

    const { mapName, x, y } = path[index];
    const node = worldNodeAt(mapName, x, y);
    if (node) return node;
  }

  return undefined;
}

// Arriving at a gateway node fires whatever it does (usually a fight), so the caller decides which ones are acceptable stops.
export function decreeRouteTo(
  target: WorldNodeEntry,
  canStopAt: (gateway: WorldNodeEntry) => boolean,
): DecreeRoute | undefined {
  const directPath = travelPathTo(target.nodeName);
  if (directPath) return { hop: target, steps: directPath.length };

  const path = travelPathThroughNodesTo(target.nodeName);
  const gateway = path ? firstCrossedNode(path) : undefined;
  if (!path || !gateway || !canStopAt(gateway)) return undefined;

  return { hop: gateway, steps: path.length };
}
