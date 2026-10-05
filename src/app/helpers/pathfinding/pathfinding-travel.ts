import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { discoveredCollectibleCount } from '@helpers/item/collectibles';
import { allMaps } from '@helpers/maps';
import {
  findInMapPath,
  findTeleportArrivalByTag,
  teleportNodeProperty,
  travelPathViaTeleport,
  unlockedTeleportNodes,
} from '@helpers/pathfinding/pathfinding';
import { worldCurrentLocationState } from '@helpers/state-game';
import { outpostsWithTeleportUnlocked } from '@helpers/world-node/world-node-outpost';
import {
  isWorldNodeCollectibleGateMet,
  worldNodeByName,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  OutpostRouting,
  TravelRouteEdge,
  TravelStep,
  WorldNodeEntry,
} from '@interfaces';
import { minBy } from 'es-toolkit/compat';

// Dijkstra node id: '' is the origin, or a gateway arrival's own nodeName (globally unique) - landing
// on that tile is exactly what a hop does, so it doubles as a waypoint key.
const ROUTE_START_KEY = '';

// One edge per gateway, so the walk to it is pathed once however many arrivals it fans out to.
function teleportNodeEdges(ignoreCollectibleGate: boolean): TravelRouteEdge[] {
  return unlockedTeleportNodes(ignoreCollectibleGate).flatMap(
    (gateway): TravelRouteEdge[] => {
      const toTag = teleportNodeProperty(gateway, 'toTag');
      const arrival = toTag
        ? findTeleportArrivalByTag(toTag, ignoreCollectibleGate)
        : undefined;
      return arrival ? [{ gateway, arrivals: [arrival] }] : [];
    },
  );
}

function outpostEdges(outposts: WorldNodeEntry[]): TravelRouteEdge[] {
  return outposts.map((gateway) => ({
    gateway,
    arrivals: outposts.filter(
      (arrival) => arrival.nodeName !== gateway.nodeName,
    ),
  }));
}

// 'Unlocked' reads save-state outpost levels, so content-only tooling (ignoreCollectibleGate) never mixes them in.
function routableOutposts(
  outpostRouting: OutpostRouting,
  ignoreCollectibleGate: boolean,
): WorldNodeEntry[] {
  if (outpostRouting === 'AllMaxed') {
    const outposts = worldNodesOfType('Outpost');
    return ignoreCollectibleGate
      ? outposts
      : outposts.filter(isWorldNodeCollectibleGateMet);
  }
  return outpostRouting === 'Unlocked' && !ignoreCollectibleGate
    ? outpostsWithTeleportUnlocked()
    : [];
}

function routeWaypoints(
  location: CurrentLocation,
  edges: TravelRouteEdge[],
): Map<string, CurrentLocation> {
  const waypoints = new Map<string, CurrentLocation>([
    [ROUTE_START_KEY, location],
  ]);
  edges.forEach(({ arrivals }) =>
    arrivals.forEach((arrival) => waypoints.set(arrival.nodeName, arrival)),
  );
  return waypoints;
}

// Cost uses base tick cost (not the A* search weight, and not buff-boosted, so routes stay cache-stable); the jump itself is free.
function routeWalkToGateway(
  from: CurrentLocation,
  gateway: WorldNodeEntry,
  passThroughNodes: boolean,
): { steps: TravelStep[]; cost: number } | undefined {
  const steps = findInMapPath(from.mapName, from, gateway, passThroughNodes);
  return steps
    ? { steps, cost: travelPathBaseTotalTicks(steps, from) }
    : undefined;
}

function teleportStepTo(arrival: WorldNodeEntry): TravelStep {
  return {
    kind: 'Teleport',
    mapName: arrival.mapName,
    x: arrival.x,
    y: arrival.y,
  };
}

// Dijkstra over every hop arrival (plus the origin) so a destination behind multiple hops still
// resolves via the cheapest chain, not just the first one found; linear-scan min-pick is fine since the graph is tiny.
function travelPathViaHops(
  location: CurrentLocation,
  destination: WorldNodeEntry,
  edges: TravelRouteEdge[],
  passThroughNodes: boolean,
): TravelStep[] | undefined {
  const waypoints = routeWaypoints(location, edges);

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

    edges
      .filter(({ gateway }) => gateway.mapName === currentPos.mapName)
      .forEach(({ gateway, arrivals }) => {
        const walk = routeWalkToGateway(currentPos, gateway, passThroughNodes);
        if (!walk) return;

        const candidateDist = currentDist + walk.cost;
        arrivals.forEach((arrival) => {
          if (
            candidateDist >=
            (dist.get(arrival.nodeName) ?? Number.POSITIVE_INFINITY)
          ) {
            return;
          }
          dist.set(arrival.nodeName, candidateDist);
          stepsFromStart.set(arrival.nodeName, [
            ...currentSteps,
            ...walk.steps,
            teleportStepTo(arrival),
          ]);
        });
      });
  }

  let bestSteps: TravelStep[] | undefined;
  let bestCost = Number.POSITIVE_INFINITY;

  waypoints.forEach((pos, key) => {
    if (pos.mapName !== destination.mapName) return;
    const waypointDist = dist.get(key);
    if (waypointDist === undefined) return;

    const finalLegSteps = findInMapPath(
      destination.mapName,
      pos,
      destination,
      passThroughNodes,
    );
    if (!finalLegSteps) return;

    const totalCost =
      waypointDist + travelPathBaseTotalTicks(finalLegSteps, pos);
    if (totalCost < bestCost) {
      bestCost = totalCost;
      bestSteps = [...stepsFromStart.get(key)!, ...finalLegSteps];
    }
  });

  return bestSteps;
}

// Cleared when maps reload, a collectible is found (can flip a gated TeleportNode - see
// unlockedTeleportNodes) or the +5 outpost set changes; otherwise (origin, destination) always resolves the same.
let cachedMapsRef: ReturnType<typeof allMaps> | undefined;
let cachedDiscoveredCollectibleCount: number | undefined;
let cachedOutpostTeleportKey: string | undefined;
const pathFromCache = new Map<string, TravelStep[] | undefined>();

function pathFromCacheKey(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport: boolean,
  ignoreCollectibleGate: boolean,
  passThroughNodes: boolean,
  outpostRouting: OutpostRouting,
): string {
  return `${location.mapName}:${location.x}:${location.y}::${destinationNodeName}::${allowTeleport}:${ignoreCollectibleGate}:${passThroughNodes}:${outpostRouting}`;
}

// Pure by-location variant, so non-party travelers (workers) can path from an arbitrary origin, not just the hero
// party's current tile. `ignoreCollectibleGate` is for content-only debug/analysis tooling; NPC town workers pass `outpostRouting = 'None'`.
export function travelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport = true,
  ignoreCollectibleGate = false,
  passThroughNodes = false,
  outpostRouting: OutpostRouting = 'Unlocked',
): TravelStep[] | undefined {
  const currentMaps = allMaps();
  const currentDiscoveredCollectibleCount = discoveredCollectibleCount();
  const currentOutpostTeleportKey = outpostsWithTeleportUnlocked()
    .map((entry) => entry.nodeName)
    .join('|');
  if (
    currentMaps !== cachedMapsRef ||
    currentDiscoveredCollectibleCount !== cachedDiscoveredCollectibleCount ||
    currentOutpostTeleportKey !== cachedOutpostTeleportKey
  ) {
    cachedMapsRef = currentMaps;
    cachedDiscoveredCollectibleCount = currentDiscoveredCollectibleCount;
    cachedOutpostTeleportKey = currentOutpostTeleportKey;
    pathFromCache.clear();
  }

  const key = pathFromCacheKey(
    location,
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
    passThroughNodes,
    outpostRouting,
  );
  if (pathFromCache.has(key)) return pathFromCache.get(key);

  const path = computeTravelPathFrom(
    location,
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
    passThroughNodes,
    outpostRouting,
  );
  pathFromCache.set(key, path);
  return path;
}

function computeTravelPathFrom(
  location: CurrentLocation,
  destinationNodeName: string,
  allowTeleport: boolean,
  ignoreCollectibleGate: boolean,
  passThroughNodes: boolean,
  outpostRouting: OutpostRouting,
): TravelStep[] | undefined {
  const destination = worldNodeByName(destinationNodeName);
  if (!destination) return undefined;

  // Traveling "to" a TeleportNode means crossing it, not just standing next
  // to it - so the jump to its paired arrival tile is part of this path.
  if (destination.nodeData.type === 'TeleportNode') {
    return allowTeleport
      ? travelPathViaTeleport(
          location,
          destination,
          ignoreCollectibleGate,
          passThroughNodes,
        )
      : undefined;
  }

  const isSameMap = location.mapName === destination.mapName;
  if (!allowTeleport) {
    return isSameMap
      ? findInMapPath(location.mapName, location, destination, passThroughNodes)
      : undefined;
  }

  const outposts = routableOutposts(outpostRouting, ignoreCollectibleGate);
  const outpostHopStartsHere =
    outposts.length > 1 &&
    outposts.some((outpost) => outpost.mapName === location.mapName);
  if (isSameMap && !outpostHopStartsHere) {
    return findInMapPath(
      location.mapName,
      location,
      destination,
      passThroughNodes,
    );
  }

  const edges = [
    ...teleportNodeEdges(ignoreCollectibleGate),
    ...outpostEdges(outposts),
  ];
  return travelPathViaHops(location, destination, edges, passThroughNodes);
}

export function travelPathTo(
  destinationNodeName: string,
  allowTeleport = true,
  ignoreCollectibleGate = false,
): TravelStep[] | undefined {
  return travelPathFrom(
    worldCurrentLocationState(),
    destinationNodeName,
    allowTeleport,
    ignoreCollectibleGate,
  );
}

// Last-resort route for a node walled in behind other nodes; only the first node it crosses is actually reachable.
export function travelPathThroughNodesTo(
  destinationNodeName: string,
): TravelStep[] | undefined {
  return travelPathFrom(
    worldCurrentLocationState(),
    destinationNodeName,
    true,
    false,
    true,
  );
}
