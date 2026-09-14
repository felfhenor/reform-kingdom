import { CHARACTER_MAX_LEVEL } from '@helpers/config';
import { applyRecipeDiscovery } from '@helpers/crafting/recipes';
import { rangeAtLevel } from '@helpers/engine/leveled-range';
import { globalEffectSums } from '@helpers/hero/global-effects';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { newEquipmentItem } from '@helpers/item/equipment';
import { applyMaterialDelta } from '@helpers/item/materials';
import { addArmoryItems } from '@helpers/kingdom/armory';
import { rngNumberRange } from '@helpers/rng';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  DroppedReward,
  GameState,
  ResolvedCollectibleDrop,
  ResolvedDrop,
  ResolvedEquipmentDrop,
  ResolvedWorkerDrop,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Flat percent from the precomputed global effect sums cache - 0 with nothing active/owned.
export function combatItemDropRateBoost(): number {
  return globalEffectSums().combatItemDropRateBoost;
}

// Shared exhaustiveness helper for `switch (x.kind)` blocks over
// DroppedReward/ResolvedDrop - a missing case fails to compile here (via the
// `never` parameter type) rather than silently falling through at runtime.
export function assertNeverReward(value: never): never {
  throw new Error(`Unhandled reward kind: ${JSON.stringify(value)}`);
}

// Display order for a dropped reward icon: workers first (rarest/most
// novel), then collectibles, equipment, recipes, then stackable items.
// Shared by the node completion reward panel and the bestiary monster drop list.
export function rewardDisplayOrder(reward: DroppedReward): number {
  switch (reward.kind) {
    case 'Worker':
      return 0;
    case 'Collectible':
      return 1;
    case 'Equipment':
      return 2;
    case 'Recipe':
      return 3;
    case 'Item':
      return 4;
    default:
      return assertNeverReward(reward);
  }
}

function resolveDrop(
  drop: DroppedReward,
  level: number,
  bonusChancePercent: number,
): ResolvedDrop | undefined {
  const chance = clamp(drop.chance + bonusChancePercent, 0, 100);
  const shouldDrop = rngNumberRange(0, 100) < chance;
  if (!shouldDrop) return undefined;

  switch (drop.kind) {
    case 'Equipment':
      return { equipmentId: drop.equipmentId, kind: 'Equipment' };
    case 'Collectible':
      return { collectibleId: drop.collectibleId, kind: 'Collectible' };
    case 'Recipe':
      return { recipeId: drop.recipeId, kind: 'Recipe' };
    case 'Worker':
      return { workerId: drop.workerId, kind: 'Worker' };
    case 'Item': {
      const range = rangeAtLevel(drop, level);
      const quantity = rngNumberRange(range.min, range.max);
      if (quantity <= 0) return undefined;
      return { itemId: drop.itemId, quantity, kind: 'Item' };
    }
    default:
      return assertNeverReward(drop);
  }
}

export function rollDroppedRewards(
  rewards: DroppedReward[],
  level: number,
  bonusChancePercent = 0,
): ResolvedDrop[] {
  return rewards
    .filter(
      (drop) =>
        (drop.minLevel ?? 0) <= level &&
        (drop.maxLevel ?? CHARACTER_MAX_LEVEL) >= level,
    )
    .map((drop) => resolveDrop(drop, level, bonusChancePercent))
    .filter((drop): drop is ResolvedDrop => !!drop);
}

function applyEquipmentDrop(
  state: GameState,
  drop: ResolvedEquipmentDrop,
): void {
  addArmoryItems(
    state,
    drop.equipmentId,
    [newEquipmentItem(drop.equipmentId)],
    true,
  );
}

function applyCollectibleDrop(
  state: GameState,
  drop: ResolvedCollectibleDrop,
): void {
  applyCollectibleGrant(state, drop.collectibleId, 1);
}

function applyWorkerDrop(state: GameState, drop: ResolvedWorkerDrop): void {
  if (state.discoveredWorkers[drop.workerId]) return;
  state.discoveredWorkers[drop.workerId] = { foundAt: Date.now() };
  state.workers[drop.workerId] = defaultWorkerState();
}

// Mutates `state` directly with no side effects, for callers already inside their own `updateGamestate`.
export function applyResolvedDropToState(
  state: GameState,
  drop: ResolvedDrop,
): void {
  switch (drop.kind) {
    case 'Item':
      applyMaterialDelta(state, drop.itemId, drop.quantity);
      return;
    case 'Equipment':
      applyEquipmentDrop(state, drop);
      return;
    case 'Collectible':
      applyCollectibleDrop(state, drop);
      return;
    case 'Recipe':
      applyRecipeDiscovery(state, drop.recipeId);
      return;
    case 'Worker':
      applyWorkerDrop(state, drop);
      return;
    default:
      assertNeverReward(drop);
  }
}
