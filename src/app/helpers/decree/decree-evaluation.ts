import { isXpTrivialAtOverLevel } from '@helpers/combat/monster';
import {
  CHARACTER_MAX_LEVEL,
  LEVEL_UP_NODE_FAILURE_LIMIT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  decreeNodeFailureCount,
  decreeWaitForFullEnergyBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { decreeRouteTo } from '@helpers/decree/decree-route';
import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import { isPartyAtFullEnergy, isPartyAtFullHealth } from '@helpers/hero/party';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { partyMinLevel } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { telegraphedRaidTownIds } from '@helpers/town/raid/town-raid-state';
import { homeNodeGet, isPlayerAtHome } from '@helpers/town/town-spawn';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node/world-node-encounter';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeObtainableMissingRewards } from '@helpers/world-node/world-node-rewards';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeRiskLevel,
  DecreeRoute,
  ExploreNodeRiskBand,
  MaterialId,
  TownContent,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

const RISK_ORDINAL: Record<DecreeRiskLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export function riskLevelOfExploreNode(
  entry: WorldNodeEntry,
): ExploreNodeRiskBand {
  const levelRange =
    worldNodeEncounter(entry)?.levelRange ??
    worldNodeEncounterRandom(entry)?.levelRange;
  if (!levelRange) return 'TooHigh';

  return riskBandForLevelRange(levelRange, partyMinLevel());
}

export function riskLevelSatisfies(
  band: ExploreNodeRiskBand,
  ceiling: DecreeRiskLevel,
): boolean {
  if (band === 'TooHigh') return false;
  return RISK_ORDINAL[band] <= RISK_ORDINAL[ceiling];
}

// A gateway's fight happens on arrival, so it has to fit the risk too; a gather would start one no clause tracks.
function canStopEnRoute(
  entry: WorldNodeEntry,
  riskTolerance: DecreeRiskLevel,
): boolean {
  if (!isWorldNodeVisible(entry)) return false;
  if (worldNodeGathering(entry) || worldNodeEncounterRandom(entry)) {
    return false;
  }
  if (!worldNodeEncounter(entry)) return true;

  return riskLevelSatisfies(riskLevelOfExploreNode(entry), riskTolerance);
}

function routeTo(
  entry: WorldNodeEntry,
  riskTolerance: DecreeRiskLevel,
): DecreeRoute | undefined {
  return decreeRouteTo(entry, (gateway) =>
    canStopEnRoute(gateway, riskTolerance),
  );
}

// Clauses with no risk setting of their own still have to fight through a gateway to get anywhere past it.
function clauseRiskTolerance(clause: DecreeClause): DecreeRiskLevel {
  return 'riskTolerance' in clause ? clause.riskTolerance : 'High';
}

// Nearest reachable node by fewest pathfinding steps - only called while idle or stationary (path cache hits), never mid-travel.
function nearestReachableNode(
  candidates: WorldNodeEntry[],
  riskTolerance: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  let nearest: WorldNodeEntry | undefined;
  let nearestSteps = Infinity;

  candidates.forEach((candidate) => {
    const steps = routeTo(candidate, riskTolerance)?.steps;
    if (steps === undefined || steps >= nearestSteps) return;

    nearest = candidate;
    nearestSteps = steps;
  });

  return nearest;
}

// Random nodes reroll their rewards every cycle, so they're unfinished whenever this cycle's fights are still up.
function isUnfinishedArea(entry: WorldNodeEntry): boolean {
  if (worldNodeEncounterRandom(entry)) {
    return worldNodeExploreRandomIsAvailable(entry);
  }

  return worldNodeObtainableMissingRewards(entry).length > 0;
}

export function nearestUnfinishedExploreNode(
  riskTolerance: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  const candidates = [
    ...worldNodesOfType('ExploreNode'),
    ...worldNodesOfType('ExploreRandomNode'),
  ]
    .filter(isWorldNodeVisible)
    .filter(isUnfinishedArea)
    .filter((entry) =>
      riskLevelSatisfies(riskLevelOfExploreNode(entry), riskTolerance),
    );

  return nearestReachableNode(candidates, riskTolerance);
}

// Toughest fight a node can throw at the party; used to rank by challenge rather than distance.
function worldNodeChallengeLevel(entry: WorldNodeEntry): number {
  return worldNodeEncounter(entry)?.levelRange.max ?? -Infinity;
}

// A loss at the gateway counts against the node behind it, or LevelUpParty would never give up on that node.
function routeFailureCount(
  entry: WorldNodeEntry,
  ceiling: DecreeRiskLevel,
): number {
  const hop = routeTo(entry, ceiling)?.hop ?? entry;
  return Math.max(
    decreeNodeFailureCount(entry.nodeName),
    decreeNodeFailureCount(hop.nodeName),
  );
}

// Shortest current losing streak; ties keep entries' existing order for deterministic results.
function leastFailedNodeIn(
  entries: WorldNodeEntry[],
  ceiling: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  return sortBy(entries, (entry) => routeFailureCount(entry, ceiling))[0];
}

// Ranked by challenge (not proximity) within the clause's risk tolerance; steps down a tier once it's lost LEVEL_UP_NODE_FAILURE_LIMIT+ fights in a row, so the party settles where it can actually win.
export function mostChallengingExploreNodeForRisk(
  ceiling: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  // XP is per hero, so a node stays worthwhile until even the weakest hero has outgrown it.
  const partyLevel = partyMinLevel();

  const candidates = worldNodesOfType('ExploreNode')
    .filter((entry) => isWorldNodeVisible(entry))
    .filter((entry) =>
      riskLevelSatisfies(riskLevelOfExploreNode(entry), ceiling),
    )
    .filter(
      (entry) =>
        !isXpTrivialAtOverLevel(partyLevel, worldNodeChallengeLevel(entry)),
    )
    .filter((entry) => !!routeTo(entry, ceiling));
  if (candidates.length === 0) return undefined;

  const challengeTiers = sortBy(
    [...new Set(candidates.map(worldNodeChallengeLevel))],
    (level) => -level,
  );

  for (const tier of challengeTiers) {
    const tierNodes = candidates.filter(
      (entry) => worldNodeChallengeLevel(entry) === tier,
    );
    const best = leastFailedNodeIn(tierNodes, ceiling);
    if (
      best &&
      routeFailureCount(best, ceiling) < LEVEL_UP_NODE_FAILURE_LIMIT
    ) {
      return best;
    }
  }

  // Every tier losing too often - fall back to whatever's failed least overall.
  return leastFailedNodeIn(candidates, ceiling);
}

export function nearestGatherNodeFor(
  materialId: MaterialId,
): WorldNodeEntry | undefined {
  const candidates = worldNodesOfType('GatherNode').filter(
    (entry) =>
      isGatherNodeDiscovered(entry.nodeName) &&
      isWorldNodeVisible(entry) &&
      worldNodeGatherMaterialIds(entry).includes(materialId),
  );

  return nearestReachableNode(candidates, 'High');
}

function acceptableRaidTowns(riskTolerance: DecreeRiskLevel): TownContent[] {
  const partyLevel = partyMinLevel();

  return telegraphedRaidTownIds()
    .map((townId) => getEntry<TownContent>(townId))
    .filter((town): town is TownContent => !!town)
    .filter((town) =>
      riskLevelSatisfies(
        riskBandForLevelRange(town.defense.assaulter.level, partyLevel),
        riskTolerance,
      ),
    );
}

function reachableVisibleNode(
  nodeName: string,
  riskTolerance: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  const entry = worldNodeByName(nodeName);
  if (!entry || !isWorldNodeVisible(entry)) return undefined;
  return routeTo(entry, riskTolerance) ? entry : undefined;
}

function defendTownsTargetNode(
  clause: Extract<DecreeClause, { type: 'DefendTowns' }>,
): WorldNodeEntry | undefined {
  const acceptable = acceptableRaidTowns(clause.riskTolerance);

  if (clause.townName) {
    if (!acceptable.some((town) => town.name === clause.townName)) {
      return undefined;
    }
    return reachableVisibleNode(clause.townName, clause.riskTolerance);
  }

  const candidates = acceptable
    .map((town) => worldNodeByName(town.name))
    .filter(
      (entry): entry is WorldNodeEntry => !!entry && isWorldNodeVisible(entry),
    );
  return nearestReachableNode(candidates, clause.riskTolerance);
}

// Mystical nodes have nothing to fight once cleared, so they only count while their cycle is up.
function farmNodeTarget(nodeName: string): WorldNodeEntry | undefined {
  const entry = reachableVisibleNode(nodeName, 'High');
  if (!entry || !worldNodeEncounterRandom(entry)) return entry;

  return worldNodeExploreRandomIsAvailable(entry) ? entry : undefined;
}

// The node a clause would travel to if run right now, or undefined if it has
// no node target (`ReturnToKingdom`) or nothing currently qualifies.
export function clauseTargetNode(
  clause: DecreeClause,
): WorldNodeEntry | undefined {
  switch (clause.type) {
    case 'GatherMaterial':
      return clause.nodeName
        ? reachableVisibleNode(clause.nodeName, 'High')
        : nearestGatherNodeFor(clause.materialId);
    case 'FarmNode':
      return farmNodeTarget(clause.nodeName);
    case 'FinishUnfinishedAreas':
      return nearestUnfinishedExploreNode(clause.riskTolerance);
    case 'LevelUpParty':
      return mostChallengingExploreNodeForRisk(clause.riskTolerance);
    case 'ReturnToKingdom':
      return undefined;
    case 'DefendTowns':
      return defendTownsTargetNode(clause);
  }
}

// Falls back to the target so an unroutable one still hits travel's pathing-failure recovery.
export function decreeTravelHopTo(
  target: WorldNodeEntry,
  riskTolerance: DecreeRiskLevel = 'High',
): WorldNodeEntry {
  return routeTo(target, riskTolerance)?.hop ?? target;
}

export function clauseTravelNode(
  clause: DecreeClause,
): WorldNodeEntry | undefined {
  const target =
    clause.type === 'ReturnToKingdom'
      ? homeNodeGet()
      : clauseTargetNode(clause);
  if (!target) return undefined;

  return decreeTravelHopTo(target, clauseRiskTolerance(clause));
}

// Only gates clause types that travel to an ExploreNode; GatherMaterial/ReturnToKingdom never risk combat.
function blockedByHealth(): boolean {
  return (
    (decreeWaitForFullHealthBeforeCombat() && !isPartyAtFullHealth()) ||
    (decreeWaitForFullEnergyBeforeCombat() && !isPartyAtFullEnergy())
  );
}

export function isClauseSatisfiable(clause: DecreeClause): boolean {
  if (!clause.enabled) return false;

  switch (clause.type) {
    case 'GatherMaterial':
      return (
        getMaterialQuantity(clause.materialId) < clause.targetQuantity &&
        !!clauseTargetNode(clause)
      );
    case 'FarmNode':
      return (
        !blockedByHealth() &&
        farmNodeRewardQuantity(clause.reward) < clause.targetQuantity &&
        !!clauseTargetNode(clause)
      );
    case 'FinishUnfinishedAreas':
      return !blockedByHealth() && !!clauseTargetNode(clause);
    case 'LevelUpParty':
      return (
        !blockedByHealth() &&
        partyMinLevel() < CHARACTER_MAX_LEVEL &&
        !!clauseTargetNode(clause)
      );
    case 'ReturnToKingdom':
      return !isPlayerAtHome();
    case 'DefendTowns':
      return !blockedByHealth() && !!clauseTargetNode(clause);
  }
}

// Lets Auto Mode distinguish "nothing to do" (fall back home) from "paused to heal" (stay put and recover).
export function isClauseBlockedOnlyByHealth(clause: DecreeClause): boolean {
  if (!clause.enabled || !blockedByHealth()) return false;

  switch (clause.type) {
    case 'FarmNode':
      return (
        farmNodeRewardQuantity(clause.reward) < clause.targetQuantity &&
        !!clauseTargetNode(clause)
      );
    case 'FinishUnfinishedAreas':
      return !!clauseTargetNode(clause);
    case 'LevelUpParty':
      return (
        partyMinLevel() < CHARACTER_MAX_LEVEL && !!clauseTargetNode(clause)
      );
    case 'DefendTowns':
      return !!clauseTargetNode(clause);
    default:
      return false;
  }
}

// A clause waiting on health still outranks everything below it, so the party heals for it instead of drifting to a lower clause.
export function pickTopPriorityClause(
  clauses: DecreeClause[],
): DecreeClause | undefined {
  return clauses.find(
    (clause) =>
      isClauseSatisfiable(clause) || isClauseBlockedOnlyByHealth(clause),
  );
}
