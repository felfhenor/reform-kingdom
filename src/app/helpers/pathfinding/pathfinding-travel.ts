import { travelPathTotalTicks } from '@helpers/hero/travel-cost';
import { allMaps } from '@helpers/maps';
import {
  findInMapPath,
  findTeleportArrivalByTag,
  teleportNodeProperty,
  travelPathViaTeleport,
} from '@helpers/pathfinding/pathfinding';
import { currentLocationGet } from '@helpers/world';
import {
  worldNodeByName,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { CurrentLocation, TravelStep, WorldNodeEntry } from '@interfaces';
import { minBy } from 'es-toolkit/compat';

// Dijkstra node id: '' is the origin, or a TeleportNode's own nodeName (globally unique) - landing
// on that tile is exactly what a teleport hop does, so it doubles as a waypoint key.
const ROUTE_START_KEY = '';

function routeWaypoints(
  location: CurrentLocation,
  teleportNodes: WorldNodeEntry[],
): Map<string, CurrentLocation> {
  const waypoints = new Map<string, CurrentLocation>([
    [ROUTE_START_KEY, location],
  ]);
  teleportNodes.forEach((node) => waypoints.set(node.nodeName, node));
  return waypoints;
}

// Cost uses real tick cost (`travelPathTotalTicks`), not the A* search weight, so "cheapest chain" means the actual cheapest trip.
function teleportHop(
  from: CurrentLocation,
  teleport: WorldNodeEntry,
): { arrivalKey: string; steps: TravelStep[]; cost: number } | undefined {
  const toTag = teleportNodeProperty(teleport, 'toTag');
  const arrival = toTag ? findTeleportArrivalByTag(toTag) : undefined;
  if (!arrival) return undefined;

  const walkSteps = findInMapPath(from.mapName, from, teleport);
  if (!walkSteps) return undefined;

  const teleportStep: TravelStep = {
    kind: 'Teleport',
    mapName: arrival.mapName,
    x: arrival.x,
    y: arrival.y,
  };
  const steps = [...walkSteps, teleportStep];

  return {
    arrivalKey: arrival.nodeName,
    steps,
    cost: travelPathTotalTicks(steps, from),
  };
}

// Dijkstra over every TeleportNode (plus the origin) so a destination behind multiple hops still
// resolves via the cheapest chain, not just the first one found; linear-scan min-pick is fine since the graph is tiny.
function travelPathAcrossMaps(
  location: CurrentLocation,
  destination: WorldNodeEntry,
): TravelStep[] | undefined {
  const teleportNodes = worldNodesOfType('TeleportNode');
  const waypoints = routeWaypoints(location, teleportNodes);

  const dist = new Map<string, number>([[ROUTE_START_KEY, 0]]);
  const stepsFromStart = new Map<string, TravelStep[]>([[ROUTE_START_KEY, []]]);
  const unvisited = new Set(waypoints.keys());

  while (unvisited.size > 0) {
    const currentKey = minBy([...unvisited], (key) => dist.get(key) ?? Number.POSITIVE_INFINITY);
    const currentDist = currentKey === undefined ? undefined : dist.get(currentKey);
    if (currentKey === undefined || currentDist === undefined) break;

    unvisited.delete(currentKey);
    const currentPos = waypoints.get(currentKey)!;
    const currentSteps = stepsFromStart.get(currentKey)!;

    teleportNodes
      .filter((node) => node.mapName === currentPos.mapName)
      .forEach((teleport) => {
        const hop = teleportHop(currentPos, teleport);
        if (!hop) return;

        const candidateDist = currentDist + hop.cost;
        if (candidateDist < (dist.get(hop.arrivalKey) ?? Number.POSITIVE_INFINITY)) {
          dist.set(hop.arrivalKey, candidateDist);
          stepsFromStart.set(hop.arrivalKey, [...currentSteps, ...hop.steps]);
        }
      });
  }

  let bestSteps: TravelStep[] | undefined;
  let bestCost = Number.POSITIVE_INFINITY;

  waypoints.forEach((pos, key) => {
    if (pos.mapName !== destination.mapName) return;
    const waypointDist = dist.get(key);
    if (waypointDist === undefined) return;

    const finalLegSteps = findInMapPath(destination.mapName, pos, destination);
    if (!finalLegSteps) return;

    const totalCost = waypointDist + travelPathTotalTicks(finalLegSteps, pos);
    if (totalCost < bestCost) {
      bestCost = totalCost;
      bestSteps = [...stepsFromStart.get(key)!, ...finalLegSteps];
    }
  });

  return bestSteps;
}

// Cleared whenever allMaps() changes (real app: once, at load) - same (origin, destination) always resolves to the
// same path otherwise, which is what stops a stamina check from re-pathfinding once per item at a node instead of once per node.
let cachedMapsRef: ReturnType<typeof allMaps> | undefined;
const pathFromCache = new Map<string, TravelStep[] | undefined>();

function pathFromCacheKey(
  location: CurrentLocation,
  destinationNodeName: string,
): string {
  return `${location.mapName}:${location.x}:${location.y}::${destinationNodeName}`;
}

// Pure by-location variant of `travelPathTo`, so non-party travelers (workers - see
// `worker-travel.ts`) can path from an arbitrary origin, not just the hero party's current tile.
export function travelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
): TravelStep[] | undefined {
  const currentMaps = allMaps();
  if (currentMaps !== cachedMapsRef) {
    cachedMapsRef = currentMaps;
    pathFromCache.clear();
  }

  const key = pathFromCacheKey(location, destinationNodeName);
  if (pathFromCache.has(key)) return pathFromCache.get(key);

  const path = computeTravelPathFrom(location, destinationNodeName);
  pathFromCache.set(key, path);
  return path;
}

function computeTravelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
): TravelStep[] | undefined {
  const destination = worldNodeByName(destinationNodeName);
  if (!destination) return undefined;

  // Traveling "to" a TeleportNode means crossing it, not just standing next
  // to it - so the jump to its paired arrival tile is part of this path.
  if (destination.nodeData.type === 'TeleportNode') {
    return travelPathViaTeleport(location, destination);
  }

  if (location.mapName === destination.mapName) {
    return findInMapPath(location.mapName, location, destination);
  }

  return travelPathAcrossMaps(location, destination);
}

export function travelPathTo(
  destinationNodeName: string,
): TravelStep[] | undefined {
  return travelPathFrom(currentLocationGet(), destinationNodeName);
}
