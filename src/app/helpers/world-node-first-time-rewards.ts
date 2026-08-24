import { rangeAtLevel } from '@helpers/leveled-range';
import { applyMaterialDelta } from '@helpers/materials';
import { researchPointItemId } from '@helpers/research/research';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  worldNodeByName,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
} from '@helpers/world-nodes';
import type {
  DroppedItemReward,
  DroppedReward,
  GameState,
  GameStateFirstTimeNodeRewardsGranted,
  WorldNodeEntry,
} from '@interfaces';

export function isFirstTimeNodeRewardsGranted(nodeName: string): boolean {
  return !!gamestate().firstTimeNodeRewardsGranted[nodeName]?.foundAt;
}

// `rpGranted` is the actual resolved Insight Crystal quantity, not just a
// boolean - reconcileFirstTimeRewardGrants (migrate.ts) needs it to top up
// or claw back if the authored amount changes later.
export function markFirstTimeNodeRewardsGranted(
  nodeName: string,
  rpGranted: number,
): void {
  updateGamestate((state) => {
    const existing = state.firstTimeNodeRewardsGranted[nodeName];
    state.firstTimeNodeRewardsGranted[nodeName] = {
      foundAt: existing?.foundAt ?? Date.now(),
      rpGranted,
    };
    return state;
  });
}

// Takes an existence check (not `worldNodeByName`) to avoid an import cycle,
// same reasoning as `pruneInvalidGatherNodeDiscoveries`.
export function pruneInvalidFirstTimeNodeRewardsGranted(
  granted: GameStateFirstTimeNodeRewardsGranted,
  nodeExists: (nodeName: string) => boolean,
): GameStateFirstTimeNodeRewardsGranted {
  const pruned: GameStateFirstTimeNodeRewardsGranted = {};

  Object.keys(granted).forEach((nodeName) => {
    if (nodeExists(nodeName)) {
      pruned[nodeName] = granted[nodeName];
    }
  });

  return pruned;
}

function nodeFirstTimeRewards(entry: WorldNodeEntry): DroppedReward[] {
  return (
    worldNodeEncounter(entry)?.firstTimeRewards ??
    worldNodeGathering(entry)?.firstTimeRewards ??
    worldNodeEncounterRandom(entry)?.firstTimeRewards ??
    []
  );
}

// The current authored RP amount for this node, or undefined if the node no
// longer exists or no longer grants RP at all (a removal, not a rebalance -
// see reconcileFirstTimeRewardGrants below for why that distinction matters).
// Evaluated at the node's max level, same convention the researchrpgaps
// validator uses for "max obtainable" - with the min===max authoring rule,
// this is deterministic regardless of which level it's evaluated at unless a
// node's reward is deliberately given a nonzero bonusPerLevel.
function currentFirstTimeRewardRpAmount(nodeName: string): number | undefined {
  const entry = worldNodeByName(nodeName);
  if (!entry) return undefined;

  const rpItemId = researchPointItemId();
  const reward = nodeFirstTimeRewards(entry).find(
    (r): r is DroppedItemReward => 'itemId' in r && r.itemId === rpItemId,
  );
  if (!reward) return undefined;

  const level = worldNodeEncounter(entry)?.levelRange.max ??
    worldNodeGathering(entry)?.levelRange.max ??
    worldNodeEncounterRandom(entry)?.levelRange.max ??
    0;

  return rangeAtLevel(reward, level).max;
}

// Tops up or claws back a player's Insight Crystal balance to match the
// currently-authored amount for every node they've already cleared, per
// node. Deliberately does NOT claw back to zero if a node's RP reward was
// removed entirely (node deleted, or firstTimeRewards dropped from its
// content) - that's a removal, not a rebalance, and clawing back something
// legitimately earned under a since-retired rule would be punitive; the
// ledger entry is simply left as a historical record. Mutates `state`
// directly - called from migrateGameState().
export function reconcileFirstTimeRewardGrants(state: GameState): void {
  Object.keys(state.firstTimeNodeRewardsGranted).forEach((nodeName) => {
    const currentAmount = currentFirstTimeRewardRpAmount(nodeName);
    if (currentAmount === undefined) return;

    const entry = state.firstTimeNodeRewardsGranted[nodeName];
    const delta = currentAmount - entry.rpGranted;
    if (delta === 0) return;

    applyMaterialDelta(state, researchPointItemId(), delta);
    state.firstTimeNodeRewardsGranted[nodeName] = {
      ...entry,
      rpGranted: currentAmount,
    };
  });
}
