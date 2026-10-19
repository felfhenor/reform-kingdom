import { CHARACTER_MAX_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { isRecipeTownUnique } from '@helpers/crafting/recipes';
import { tradeskillBuildingIn } from '@helpers/crafting/tradeskill';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { rangeAtLevel } from '@helpers/engine/leveled-range';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { newEquipmentItem } from '@helpers/item/equipment';
import { applyMaterialDelta } from '@helpers/item/materials';
import { addArmoryItems } from '@helpers/kingdom/armory';
import { rngNumberRange } from '@helpers/rng';
import { gamestate, globalEffectSumsState } from '@helpers/state-game';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  DropChanceBonus,
  DroppedReward,
  GameState,
  RecipeContent,
  ResolvedCollectibleDrop,
  ResolvedDrop,
  ResolvedEquipmentDrop,
  ResolvedWorkerDrop,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// The global boost lifts every combat drop; Loot Goblin only equipment, Scavenger only items.
export function combatDropChanceBonus(): DropChanceBonus {
  const global = globalEffectSumsState().combatItemDropRateBoost;
  return {
    Item: global + jobAbilityValue('ItemDropRateBoost'),
    Equipment: global + jobAbilityValue('EquipmentDropRateBoost'),
    Collectible: global,
    Recipe: global,
    Worker: global,
  };
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
  bonus: DropChanceBonus,
): ResolvedDrop | undefined {
  const chance = clamp(drop.chance + (bonus[drop.kind] ?? 0), 0, 100);
  const shouldDrop = rngNumberRange(0, 99) < chance;
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

// Only a guaranteed collectible/worker proves an encounter was cleared; materials can come from elsewhere.
export function isClearProofReward(drop: DroppedReward): boolean {
  return (
    drop.chance >= 100 &&
    (drop.kind === 'Collectible' || drop.kind === 'Worker')
  );
}

// A recipe the player can never personally craft (town-exclusive), or that's
// below their current tradeskill level for it, isn't usable yet
export function isRecipeUsable(
  drop: DroppedReward,
  state: GameState = gamestate(),
): boolean {
  if (drop.kind !== 'Recipe') return true;
  if (isRecipeTownUnique(drop.recipeId)) return false;

  const recipe = getEntry<RecipeContent>(drop.recipeId);
  if (!recipe) return true;

  return (
    tradeskillBuildingIn(state, recipe.tradeskillId).level >=
    recipe.minTradeskillLevel
  );
}

export function rollDroppedRewards(
  rewards: DroppedReward[],
  level: number,
  bonus: DropChanceBonus = {},
  state: GameState = gamestate(),
): ResolvedDrop[] {
  return rewards
    .filter(
      (drop) =>
        (drop.minLevel ?? 0) <= level &&
        (drop.maxLevel ?? CHARACTER_MAX_LEVEL) >= level &&
        isRecipeUsable(drop, state),
    )
    .map((drop) => resolveDrop(drop, level, bonus))
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
  if (ledgerHas(state.discoveredWorkers, drop.workerId)) return;

  ledgerMark(state.discoveredWorkers, drop.workerId);
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
      ledgerMark(state.discoveredRecipes, drop.recipeId);
      return;
    case 'Worker':
      applyWorkerDrop(state, drop);
      return;
    default:
      assertNeverReward(drop);
  }
}
