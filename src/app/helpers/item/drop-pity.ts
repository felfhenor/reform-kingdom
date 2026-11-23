import { COMBAT_DROP_PITY_PERCENT_PER_MISS } from '@helpers/config';
import {
  combatDropChanceBonus,
  isDropRollable,
  rollDroppedRewards,
} from '@helpers/item/loot';
import { dropPityState, updateGamestate } from '@helpers/state-game';
import {
  rewardKey,
  worldNodeAllCompletionRewards,
} from '@helpers/world-node/world-node-rewards';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  DroppedReward,
  GameStateDropPity,
  ResolvedDrop,
  RewardIdentity,
} from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

export function dropPityKey(nodeName: string, reward: RewardIdentity): string {
  return `${nodeName}|${rewardKey(reward)}`;
}

export function dropPityKeyIsValid(key: string): boolean {
  const [nodeName] = key.split('|');
  const entry = worldNodeByName(nodeName);
  if (!entry) return false;

  return worldNodeAllCompletionRewards(entry).some(
    (reward) => dropPityKey(nodeName, reward) === key,
  );
}

function dropPityIsEligible(reward: DroppedReward, level: number): boolean {
  return reward.chance < 100 && isDropRollable(reward, level);
}

function dropPityBoosted(
  reward: DroppedReward,
  pity: GameStateDropPity,
  nodeName: string,
): DroppedReward {
  if (reward.chance >= 100) return reward;

  const misses = pity[dropPityKey(nodeName, reward)] ?? 0;
  return {
    ...reward,
    chance: reward.chance + misses * COMBAT_DROP_PITY_PERCENT_PER_MISS,
  };
}

export function dropPityRecord(
  pity: GameStateDropPity,
  nodeName: string,
  rewards: DroppedReward[],
  drops: ResolvedDrop[],
): void {
  const hits = new Set(drops.map((drop) => rewardKey(drop)));
  uniqBy(rewards, (reward) => rewardKey(reward)).forEach((reward) => {
    const key = dropPityKey(nodeName, reward);
    if (hits.has(rewardKey(reward))) {
      delete pity[key];
      return;
    }

    pity[key] = (pity[key] ?? 0) + 1;
  });
}

export function dropPityRollCompletionRewards(
  nodeName: string,
  rewards: DroppedReward[],
  level: number,
): ResolvedDrop[] {
  const pity = dropPityState();
  const drops = rollDroppedRewards(
    rewards.map((reward) => dropPityBoosted(reward, pity, nodeName)),
    level,
    combatDropChanceBonus(),
  );

  const eligible = rewards.filter((reward) =>
    dropPityIsEligible(reward, level),
  );
  if (eligible.length === 0) return drops;

  updateGamestate((state) => {
    dropPityRecord(state.dropPity, nodeName, eligible, drops);
    return state;
  });
  return drops;
}
