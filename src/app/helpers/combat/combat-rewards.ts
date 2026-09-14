import {
  collectibleDropHtml,
  combatMessageLog,
  equipmentDropHtml,
  ITEM_ICON_TOKEN,
  itemDropHtml,
  recipeDropHtml,
} from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { recipeDiscover } from '@helpers/crafting/recipes';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { globalEffectSums } from '@helpers/hero/global-effects';
import { collectiblesAdd } from '@helpers/item/collectibles';
import { assertNeverReward } from '@helpers/item/loot';
import { addMaterial, goldCoinId } from '@helpers/item/materials';
import { armoryAdd } from '@helpers/kingdom/armory';
import {
  isWorkerRescued,
  workerRescue,
} from '@helpers/worker/worker-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type {
  CollectibleContent,
  Combat,
  EquipmentContent,
  ItemContent,
  ItemId,
  RecipeContent,
  ResolvedDrop,
  RewardContentInfo,
  WorkerContent,
} from '@interfaces';

function emitRewardVfx(
  combat: Combat,
  info: RewardContentInfo | undefined,
  quantity: number,
): void {
  if (!info) return;

  gatherVfxEmit({ nodeName: combat.locationName, quantity, ...info });
}

function goldGainMultiplier(): number {
  return 1 + globalEffectSums().goldGainMultiplierBonus;
}

// Only Explore/ExploreRandom combat sets encounterId/encounterRandomId - raids (raidTownId) never do.
function isExploreCombat(combat: Combat): boolean {
  return !!combat.encounterId || !!combat.encounterRandomId;
}

// A worker reward always rolls its chance but only ever grants once - the already-rescued check is here.
export function grantResolvedDrops(
  combat: Combat,
  drops: ResolvedDrop[],
): void {
  const itemsFound: Record<ItemId, number> = {};

  drops.forEach((drop) => {
    switch (drop.kind) {
      case 'Equipment': {
        const admittedCount = armoryAdd(drop.equipmentId, 1, true);
        if (admittedCount === 0) {
          combatMessageLog(
            combat,
            'Your armory is full. An item drop was lost.',
          );
          return;
        }

        const equipment = getEntry<EquipmentContent>(drop.equipmentId);
        if (!equipment) return;

        const info = rewardContentInfo(drop);
        combatMessageLog(
          combat,
          `The party found ${ITEM_ICON_TOKEN}${equipmentDropHtml(equipment)}!`,
          undefined,
          info,
        );
        emitRewardVfx(combat, info, 1);
        return;
      }

      case 'Collectible': {
        collectiblesAdd(drop.collectibleId, 1);

        const collectible = getEntry<CollectibleContent>(drop.collectibleId);
        if (!collectible) return;

        const info = rewardContentInfo(drop);
        combatMessageLog(
          combat,
          `The party found ${ITEM_ICON_TOKEN}${collectibleDropHtml(collectible)}!`,
          undefined,
          info,
        );
        emitRewardVfx(combat, info, 1);
        return;
      }

      case 'Recipe': {
        recipeDiscover(drop.recipeId);

        const recipe = getEntry<RecipeContent>(drop.recipeId);
        if (!recipe) return;

        const info = rewardContentInfo(drop);
        combatMessageLog(
          combat,
          `The party found ${ITEM_ICON_TOKEN}${recipeDropHtml(recipe)}!`,
          undefined,
          info,
        );
        emitRewardVfx(combat, info, 1);
        return;
      }

      case 'Worker': {
        if (isWorkerRescued(drop.workerId)) return; // silent no-op, no duplicate

        workerRescue(drop.workerId);

        const worker = getEntry<WorkerContent>(drop.workerId);
        if (!worker) return;

        const info = rewardContentInfo(drop);
        combatMessageLog(
          combat,
          `The party rescued ${ITEM_ICON_TOKEN}${worker.name}!`,
          undefined,
          info,
        );
        emitRewardVfx(combat, info, 1);
        return;
      }

      case 'Item': {
        itemsFound[drop.itemId] =
          (itemsFound[drop.itemId] ?? 0) + drop.quantity;
        return;
      }

      default:
        assertNeverReward(drop);
    }
  });

  Object.keys(itemsFound).forEach((itemId) => {
    let quantity = itemsFound[itemId as ItemId];
    if (quantity <= 0) return;

    if (itemId === goldCoinId() && isExploreCombat(combat)) {
      quantity = Math.round(quantity * goldGainMultiplier());
    }

    addMaterial(itemId as ItemId, quantity);

    const item = getEntry<ItemContent>(itemId);
    if (!item) return;

    const info = rewardContentInfo({ itemId: itemId as ItemId });
    combatMessageLog(
      combat,
      `The party found ${ITEM_ICON_TOKEN}${itemDropHtml(item, quantity)}!`,
      undefined,
      info,
    );
    emitRewardVfx(combat, info, quantity);
  });
}
