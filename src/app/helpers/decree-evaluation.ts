import {
  decreeNodeFailureCount,
  decreeRiskTolerance,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import { farmNodeRewardQuantity } from '@helpers/decree-farm-node';
import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import { partyMaxLevel, partyMinLevel } from '@helpers/gathering';
import { getMaterialQuantity } from '@helpers/materials';
import { isXpTrivialAtOverLevel } from '@helpers/monster';
import { CHARACTER_MAX_LEVEL, isPartyAtFullHealth } from '@helpers/party';
import { travelPathTo } from '@helpers/pathfinding';
import { isPlayerAtKingdom } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeCompletionRewardProgress,
  worldNodeEncounter,
  worldNodeGatherMaterialIds,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  DecreeClause,
  DecreeRiskLevel,
  ExploreNodeRiskBand,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// A node's floor sitting this many levels above the party's weakest hero
// still counts as Medium/High risk - anything further is excluded outright
// (see `riskLevelOfExploreNode`), regardless of any risk setting. Exported
// so UI copy (the Risk Tolerance dropdown's explanations) can quote the
// real thresholds instead of hardcoding numbers that could drift out of sync.
export const MEDIUM_RISK_LEVELS_ABOVE_PARTY = 3;
export const HIGH_RISK_LEVELS_ABOVE_PARTY = 7;

// Once the least-failed node in a challenge tier has lost this many fights,
// `mostChallengingExploreNodeForRisk` gives up on that tier and steps down
// to the next easiest one - see its comment for the full ranking.
export const LEVEL_UP_NODE_FAILURE_LIMIT = 5;

const RISK_ORDINAL: Record<DecreeRiskLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export function riskLevelOfExploreNode(
  entry: WorldNodeEntry,
): ExploreNodeRiskBand {
  const encounter = worldNodeEncounter(entry);
  if (!encounter) return 'TooHigh';

  const partyLevel = partyMinLevel();
  if (encounter.levelRange.max <= partyLevel) return 'Low';

  const levelsAboveParty = encounter.levelRange.min - partyLevel;
  if (levelsAboveParty <= MEDIUM_RISK_LEVELS_ABOVE_PARTY) return 'Medium';
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
    worldNodesOfType('ExploreNode').filter(predicate),
  );
}

export function nearestUnfinishedExploreNode(): WorldNodeEntry | undefined {
  const riskTolerance = decreeRiskTolerance();

  return nearestReachableExploreNode((entry) => {
    const { obtained, total } = worldNodeCompletionRewardProgress(entry);
    if (obtained >= total) return false;

    return riskLevelSatisfies(riskLevelOfExploreNode(entry), riskTolerance);
  });
}

// The toughest fight a node within `ceiling` can throw at the party - used
// to rank explore nodes by challenge rather than distance (see
// `mostChallengingExploreNodeForRisk`).
function worldNodeChallengeLevel(entry: WorldNodeEntry): number {
  return worldNodeEncounter(entry)?.levelRange.max ?? -Infinity;
}

// The candidate in `entries` with the shortest current losing streak (see
// `decreeNodeFailureCount`) - ties keep `entries`' existing order, so a tier
// with no failure data at all still resolves deterministically.
function leastFailedNodeIn(
  entries: WorldNodeEntry[],
): WorldNodeEntry | undefined {
  return sortBy(entries, (entry) => decreeNodeFailureCount(entry.nodeName))[0];
}

// LevelUpParty has no risk setting of its own - it always targets the
// standing global `riskTolerance` directly (see `decreeRiskTolerance`).
// Ranked by challenge, not proximity - a trivial node right next to the
// kingdom does little for leveling up, so the hardest reachable node the
// tolerance allows wins even if a much easier one is closer.
//
// Within the hardest tier still worth trying, nodes that keep losing are
// passed over in favor of a comparable (same-challenge) node that hasn't
// been failing as much - see `leastFailedNodeIn`. Once every node in a tier
// has lost `LEVEL_UP_NODE_FAILURE_LIMIT`+ fights in a row, that tier is
// written off and the search steps down to the next easiest one, so the
// party settles somewhere it can actually win and keep growing instead of
// grinding forever against a fight it can't clear. A node so far below the
// party's strongest hero that it's already degraded to the flat 1 XP floor
// (see `isXpTrivialAtOverLevel`) is excluded outright, even if nothing else
// disqualifies it - clearing it wouldn't grow the party at all.
export function mostChallengingExploreNodeForRisk(): WorldNodeEntry | undefined {
  const ceiling = decreeRiskTolerance();
  const partyLevel = partyMaxLevel();

  const candidates = worldNodesOfType('ExploreNode')
    .filter((entry) => riskLevelSatisfies(riskLevelOfExploreNode(entry), ceiling))
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
    if (best && decreeNodeFailureCount(best.nodeName) < LEVEL_UP_NODE_FAILURE_LIMIT) {
      return best;
    }
  }

  // Every tier has been losing too often - fall back to whatever's failed
  // least overall rather than stalling entirely.
  return leastFailedNodeIn(candidates);
}

// Only considers GatherNodes the player has actually visited before - a
// material that's also gatherable at an undiscovered node shouldn't be
// auto-targeted there before the player has found it themselves.
export function nearestGatherNodeFor(
  materialId: MaterialId,
): WorldNodeEntry | undefined {
  const candidates = worldNodesOfType('GatherNode').filter(
    (entry) =>
      isGatherNodeDiscovered(entry.nodeName) &&
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
      if (!entry) return undefined;
      return travelPathTo(entry.nodeName) ? entry : undefined;
    }
    case 'FinishUnfinishedAreas':
      return nearestUnfinishedExploreNode();
    case 'LevelUpParty':
      return mostChallengingExploreNodeForRisk();
    case 'ReturnToKingdom':
      return undefined;
  }
}

// GatherMaterial and ReturnToKingdom never risk combat, so the "wait for
// full health" setting only ever gates the clause types that travel to an
// ExploreNode (and therefore trigger a fight on arrival).
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

// Whether `clause` would be satisfiable right now if not for the "wait for
// full health" gate - lets Auto Mode tell "genuinely nothing to do" (fall
// back to the kingdom) apart from "paused to heal" (stay put and let
// `restingProcessTick` recover the party wherever they already are).
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
