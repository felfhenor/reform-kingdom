import {
  WORKER_COMBAT_BASE_TICKS,
  WORKER_COMBAT_MIN_DROP_CHANCE,
  WORKER_COMBAT_XP_POWER_WINDOW,
} from '@helpers/config';
import { isExploreNodeCleared } from '@helpers/decree/decree-farm-node';
import {
  crimsonLucreId,
  goldCoinId,
  memoryFluxId,
  reforgeReagentId,
  traderTokenId,
} from '@helpers/item/materials';
import { isWorldNodeFought } from '@helpers/kingdom/bestiary';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import { worldNodeMonsterDropTable } from '@helpers/world-node/world-node-monster-drops';
import {
  worldNodeByName,
  worldNodeEncounter,
} from '@helpers/world-node/world-nodes';
import type { DroppedItemReward, ItemId, WorkerContent } from '@interfaces';
import { clamp, maxBy } from 'es-toolkit/compat';

function workerCombatExcludedItemIds(): Set<ItemId | undefined> {
  return new Set([
    goldCoinId(),
    crimsonLucreId(),
    traderTokenId(),
    memoryFluxId(),
    reforgeReagentId(),
  ]);
}

// Floored so the shown power always matches the level gate.
export function workerCombatPower(
  worker: WorkerContent,
  level: number,
): number {
  return Math.floor(workerStatsForLevel(worker, level).combatPower);
}

export function isWorkerCombatNode(nodeName: string): boolean {
  return worldNodeByName(nodeName)?.nodeData.type === 'ExploreNode';
}

// Max of the encounter's range, so one power check covers every fight there.
export function workerCombatNodeLevel(nodeName: string): number | undefined {
  const entry = worldNodeByName(nodeName);
  return entry ? worldNodeEncounter(entry)?.levelRange.max : undefined;
}

// Cleared plus fought there: the closest proxy for "the party beat it" without a per-node win record.
export function isWorkerCombatNodeUnlocked(nodeName: string): boolean {
  const entry = worldNodeByName(nodeName);
  if (!entry || !isWorkerCombatNode(nodeName)) return false;

  return isExploreNodeCleared(entry) && isWorldNodeFought(nodeName);
}

export function workerCombatItemDrops(
  nodeName: string,
  withRegionDrops: boolean,
): DroppedItemReward[] {
  const entry = worldNodeByName(nodeName);
  if (!entry || !isWorkerCombatNode(nodeName)) return [];

  const itemDrops = worldNodeMonsterDropTable(entry, withRegionDrops).filter(
    (reward): reward is DroppedItemReward => reward.kind === 'Item',
  );
  if (itemDrops.length === 0) return [];

  const excluded = workerCombatExcludedItemIds();
  return itemDrops.filter((reward) => !excluded.has(reward.itemId));
}

export function workerCombatBestDropChance(
  nodeName: string,
  itemId: ItemId,
  withRegionDrops: boolean,
): number {
  const drops = workerCombatItemDrops(nodeName, withRegionDrops).filter(
    (drop) => drop.itemId === itemId,
  );
  return maxBy(drops, (drop) => drop.chance)?.chance ?? 0;
}

export function workerCombatUnitTicks(
  worker: WorkerContent,
  level: number,
  nodeName: string,
  itemId: ItemId,
  withRegionDrops: boolean,
): number | undefined {
  const chance = workerCombatBestDropChance(nodeName, itemId, withRegionDrops);
  const speed = workerStatsForLevel(worker, level).combatSpeed;
  if (chance <= 0 || speed <= 0) return undefined;

  const effectiveChance = clamp(chance, WORKER_COMBAT_MIN_DROP_CHANCE, 100);
  return WORKER_COMBAT_BASE_TICKS / (speed * (effectiveChance / 100));
}

// The power and rate checks every fighter shares, kingdom or town.
export function workerCanFightFor(
  worker: WorkerContent,
  level: number,
  nodeName: string,
  itemId: ItemId,
  withRegionDrops: boolean,
): boolean {
  const nodeLevel = workerCombatNodeLevel(nodeName);
  return (
    nodeLevel !== undefined &&
    workerCombatPower(worker, level) >= nodeLevel &&
    workerCombatUnitTicks(worker, level, nodeName, itemId, withRegionDrops) !==
      undefined
  );
}

export function workerCombatGrantsXp(
  worker: WorkerContent,
  level: number,
  nodeName: string,
): boolean {
  const nodeLevel = workerCombatNodeLevel(nodeName);
  if (nodeLevel === undefined) return false;

  return (
    nodeLevel >=
    workerCombatPower(worker, level) - WORKER_COMBAT_XP_POWER_WINDOW
  );
}
