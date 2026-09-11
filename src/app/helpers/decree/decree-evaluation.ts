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
import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import {
  isPartyAtFullEnergy,
  isPartyAtFullHealth,
} from '@helpers/hero/party';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { partyMaxLevel, partyMinLevel } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { travelPathTo } from '@helpers/pathfinding/pathfinding-travel';
import { telegraphedRaidTownIds } from '@helpers/town/raid/town-raid-state';
import { isPlayerAtHome } from '@helpers/town/town-spawn';
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
  const encounter = worldNodeEncounter(entry);
  if (!encounter) return 'TooHigh';

  return riskBandForLevelRange(encounter.levelRange, partyMinLevel());
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

function defendTownsTargetNode(
  clause: Extract<DecreeClause, { type: 'DefendTowns' }>,
): WorldNodeEntry | undefined {
  const acceptable = acceptableRaidTowns(clause.riskTolerance);

  if (clause.townName) {
    if (!acceptable.some((town) => town.name === clause.townName)) {
      return undefined;
    }
    const entry = worldNodeByName(clause.townName);
    if (!entry || !isWorldNodeVisible(entry)) return undefined;
    return travelPathTo(entry.nodeName) ? entry : undefined;
  }

  const candidates = acceptable
    .map((town) => worldNodeByName(town.name))
    .filter(
      (entry): entry is WorldNodeEntry => !!entry && isWorldNodeVisible(entry),
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
    case 'DefendTowns':
      return defendTownsTargetNode(clause);
  }
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

export function pickNextClause(
  clauses: DecreeClause[],
): DecreeClause | undefined {
  return clauses.find(isClauseSatisfiable);
}
