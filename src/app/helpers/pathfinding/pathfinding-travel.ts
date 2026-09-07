import { travelPathTotalTicks } from '@helpers/hero/travel-cost';
import { discoveredCollectibleCount } from '@helpers/item/collectibles';
import { allMaps } from '@helpers/maps';
import {
  findInMapPath,
  findTeleportArrivalByTag,
  teleportNodeProperty,
  travelPathViaTeleport,
  unlockedTeleportNodes,
} from '@helpers/pathfinding/pathfinding';
import { currentLocationGet } from '@helpers/world';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
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

// Cost uses real tick cost, not the A* search weight, so "cheapest chain" means the actual cheapest trip.
function teleportHop(
  from: CurrentLocation,
  teleport: WorldNodeEntry,
  ignoreCollectibleGate: boolean,
): { arrivalKey: string; steps: TravelStep[]; cost: number } | undefined {
  const toTag = teleportNodeProperty(teleport, 'toTag');
  const arrival = toTag
    ? findTeleportArrivalByTag(toTag, ignoreCollectibleGate)
    : undefined;
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
  ignoreCollectibleGate: boolean,
): TravelStep[] | undefined {
  const teleportNodes = unlockedTeleportNodes(ignoreCollectibleGate);
  const waypoints = routeWaypoints(location, teleportNodes);

  const dist = new Map<string, number>([[ROUTE_START_KEY, 0]]);
  const stepsFromStart = new Map<string, TravelStep[]>([[ROUTE_START_KEY, []]]);
  const unvisited = new Set(waypoints.keys());

  while (unvisited.size > 0) {
    const currentKey = minBy(
      [...unvisited],
      (key) => dist.get(key) ?? Number.POSITIVE_INFINITY,
    );
    const currentDist =
      currentKey === undefined ? undefined : dist.get(currentKey);
    if (currentKey === undefined || currentDist === undefined) break;

    unvisited.delete(currentKey);
    const currentPos = waypoints.get(currentKey)!;
    const currentSteps = stepsFromStart.get(currentKey)!;

    teleportNodes
      .filter((node) => node.mapName === currentPos.mapName)
      .forEach((teleport) => {
        const hop = teleportHop(currentPos, teleport, ignoreCollectibleGate);
        if (!hop) return;

        const candidateDist = currentDist + hop.cost;
        if (
          candidateDist < (dist.get(hop.arrivalKey) ?? Number.POSITIVE_INFINITY)
        ) {
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

// Cleared when maps reload or a collectible is found (can flip a gated TeleportNode - see
// unlockedTeleportNodes); otherwise (origin, destination) always resolves the same.
let cachedMapsRef: ReturnType<typeof allMaps> | undefined;
let cachedDiscoveredCollectibleCount: number | undefined;
const pathFromCache = new Map<string, TravelStep[] | undefined>();

function pathFromCacheKey(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport: boolean,
  ignoreCollectibleGate: boolean,
): string {
  return `${location.mapName}:${location.x}:${location.y}::${destinationNodeName}::${allowTeleport}:${ignoreCollectibleGate}`;
}

// Pure by-location variant, so non-party travelers (workers) can path from an arbitrary origin, not just the hero
// party's current tile. `ignoreCollectibleGate` is for content-only debug/analysis tooling.
export function travelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport = true,
  ignoreCollectibleGate = false,
): TravelStep[] | undefined {
  const currentMaps = allMaps();
  const currentDiscoveredCollectibleCount = discoveredCollectibleCount();
  if (
    currentMaps !== cachedMapsRef ||
    currentDiscoveredCollectibleCount !== cachedDiscoveredCollectibleCount
  ) {
    cachedMapsRef = currentMaps;
    cachedDiscoveredCollectibleCount = currentDiscoveredCollectibleCount;
    pathFromCache.clear();
  }

  const key = pathFromCacheKey(
    location,
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
  );
  if (pathFromCache.has(key)) return pathFromCache.get(key);

  const path = computeTravelPathFrom(
    location,
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
  );
  pathFromCache.set(key, path);
  return path;
}

function computeTravelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport: boolean,
  ignoreCollectibleGate: boolean,
): TravelStep[] | undefined {
  const destination = worldNodeByName(destinationNodeName);
  if (!destination) return undefined;

  // Traveling "to" a TeleportNode means crossing it, not just standing next
  // to it - so the jump to its paired arrival tile is part of this path.
  if (destination.nodeData.type === 'TeleportNode') {
    return allowTeleport
      ? travelPathViaTeleport(location, destination, ignoreCollectibleGate)
      : undefined;
  }

  if (location.mapName === destination.mapName) {
    return findInMapPath(location.mapName, location, destination);
  }

  return allowTeleport
    ? travelPathAcrossMaps(location, destination, ignoreCollectibleGate)
    : undefined;
}

export function travelPathTo(
  destinationNodeName: string,
  allowTeleport = true,
  ignoreCollectibleGate = false,
): TravelStep[] | undefined {
  return travelPathFrom(
    currentLocationGet(),
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
  );
}
