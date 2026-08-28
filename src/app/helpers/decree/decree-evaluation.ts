import { isXpTrivialAtOverLevel } from '@helpers/combat/monster';
import {
  decreeNodeFailureCount,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { CHARACTER_MAX_LEVEL, isPartyAtFullHealth } from '@helpers/hero/party';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { partyMaxLevel, partyMinLevel } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { travelPathTo } from '@helpers/pathfinding/pathfinding';
import { isPlayerAtKingdom } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeEncounter,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeRiskLevel,
  ExploreNodeRiskBand,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Beyond this many levels above the party's floor, a node is excluded outright (TooHigh) regardless of risk setting.
export const HIGH_RISK_LEVELS_ABOVE_PARTY = 7;

// Losing streak at which mostChallengingExploreNodeForRisk gives up on a tier and steps down.
export const LEVEL_UP_NODE_FAILURE_LIMIT = 5;

const RISK_ORDINAL: Record<DecreeRiskLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

// Judged against both ends of the encounter's levelRange, since the roll can land anywhere in it, not just the floor.
export function riskLevelOfExploreNode(
  entry: WorldNodeEntry,
): ExploreNodeRiskBand {
  const encounter = worldNodeEncounter(entry);
  if (!encounter) return 'TooHigh';

  const partyLevel = partyMinLevel();
  if (encounter.levelRange.max <= partyLevel) return 'Low';
  if (encounter.levelRange.min <= partyLevel) return 'Medium';

  const levelsAboveParty = encounter.levelRange.min - partyLevel;
  if (levelsAboveParty <= HIGH_RISK_LEVELS_ABOVE_PARTY) return 'High';

  return 'TooHigh';
}

export function riskLevelSatisfies(
  band: ExploreNodeRiskBand,
  ceiling: DecreeRiskLevel,
): boolean {
  if (band === 'TooHigh') return false;
  return RISK_ORDINAL[band] <= RISK_ORDINAL[ceiling];
}

// Nearest reachable node by fewest pathfinding steps - only ever called on
// idle transitions, never per-tick.
function nearestReachableNode(
  candidates: WorldNodeEntry[],
): WorldNodeEntry | undefined {
  let nearest: WorldNodeEntry | undefined;
  let nearestSteps = Infinity;

  candidates.forEach((candidate) => {
    const path = travelPathTo(candidate.nodeName);
    if (!path) return;
    if (path.length >= nearestSteps) return;

    nearest = candidate;
    nearestSteps = path.length;
  });

  return nearest;
}

function nearestReachableExploreNode(
  predicate: (entry: WorldNodeEntry) => boolean,
): WorldNodeEntry | undefined {
  return nearestReachableNode(
    worldNodesOfType('ExploreNode')
      .filter(isWorldNodeVisible)
      .filter(predicate),
  );
}

export function nearestUnfinishedExploreNode(
  riskTolerance: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  return nearestReachableExploreNode((entry) => {
    const { obtained, total } = worldNodeCompletionRewardProgress(entry);
    if (obtained >= total) return false;

    return riskLevelSatisfies(riskLevelOfExploreNode(entry), riskTolerance);
  });
}

// Toughest fight a node can throw at the party; used to rank by challenge rather than distance.
function worldNodeChallengeLevel(entry: WorldNodeEntry): number {
  return worldNodeEncounter(entry)?.levelRange.max ?? -Infinity;
}

// Shortest current losing streak; ties keep entries' existing order for deterministic results.
function leastFailedNodeIn(
  entries: WorldNodeEntry[],
): WorldNodeEntry | undefined {
  return sortBy(entries, (entry) => decreeNodeFailureCount(entry.nodeName))[0];
}

// Ranked by challenge (not proximity) within the clause's risk tolerance; steps down a tier once it's lost LEVEL_UP_NODE_FAILURE_LIMIT+ fights in a row, so the party settles where it can actually win.
export function mostChallengingExploreNodeForRisk(
  ceiling: DecreeRiskLevel,
): WorldNodeEntry | undefined {
  const partyLevel = partyMaxLevel();

  const candidates = worldNodesOfType('ExploreNode')
    .filter((entry) => isWorldNodeVisible(entry))
    .filter((entry) =>
      riskLevelSatisfies(riskLevelOfExploreNode(entry), ceiling),
    )
    .filter(
      (entry) =>
        !isXpTrivialAtOverLevel(partyLevel, worldNodeChallengeLevel(entry)),
    )
    .filter((entry) => !!travelPathTo(entry.nodeName));
  if (candidates.length === 0) return undefined;

  const challengeTiers = sortBy(
    [...new Set(candidates.map(worldNodeChallengeLevel))],
    (level) => -level,
  );

  for (const tier of challengeTiers) {
    const tierNodes = candidates.filter(
      (entry) => worldNodeChallengeLevel(entry) === tier,
    );
    const best = leastFailedNodeIn(tierNodes);
    if (
      best &&
      decreeNodeFailureCount(best.nodeName) < LEVEL_UP_NODE_FAILURE_LIMIT
    ) {
      return best;
    }
  }

  // Every tier losing too often - fall back to whatever's failed least overall.
  return leastFailedNodeIn(candidates);
}

// Only considers GatherNodes the player has already discovered.
export function nearestGatherNodeFor(
  materialId: MaterialId,
): WorldNodeEntry | undefined {
  const candidates = worldNodesOfType('GatherNode').filter(
    (entry) =>
      isGatherNodeDiscovered(entry.nodeName) &&
      isWorldNodeVisible(entry) &&
      worldNodeGatherMaterialIds(entry).includes(materialId),
  );

  return nearestReachableNode(candidates);
}

// The node a clause would travel to if run right now, or undefined if it has
// no node target (`ReturnToKingdom`) or nothing currently qualifies.
export function clauseTargetNode(
  clause: DecreeClause,
): WorldNodeEntry | undefined {
  switch (clause.type) {
    case 'GatherMaterial':
      return nearestGatherNodeFor(clause.materialId);
    case 'FarmNode': {
      const entry = worldNodeByName(clause.nodeName);
      if (!entry || !isWorldNodeVisible(entry)) return undefined;
      return travelPathTo(entry.nodeName) ? entry : undefined;
    }
    case 'FinishUnfinishedAreas':
      return nearestUnfinishedExploreNode(clause.riskTolerance);
    case 'LevelUpParty':
      return mostChallengingExploreNodeForRisk(clause.riskTolerance);
    case 'ReturnToKingdom':
      return undefined;
  }
}

// Only gates clause types that travel to an ExploreNode; GatherMaterial/ReturnToKingdom never risk combat.
function blockedByHealth(): boolean {
  return decreeWaitForFullHealthBeforeCombat() && !isPartyAtFullHealth();
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
      return !isPlayerAtKingdom();
  }
}

// Lets Auto Mode distinguish "nothing to do" (fall back to kingdom) from "paused to heal" (stay put and recover).
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
    default:
      return false;
  }
}

export function pickNextClause(
  clauses: DecreeClause[],
): DecreeClause | undefined {
  return clauses.find(isClauseSatisfiable);
}
