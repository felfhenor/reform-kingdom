import {
  collectibleDropHtml,
  combatMessageLog,
  equipmentDropHtml,
  itemDropHtml,
  recipeDropHtml,
} from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import { recipeDiscover } from '@helpers/crafting/recipes';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { collectiblesAdd } from '@helpers/item/collectibles';
import { assertNeverReward } from '@helpers/item/loot';
import { addMaterial } from '@helpers/item/materials';
import { armoryAdd } from '@helpers/kingdom/armory';
import { isWorkerRescued, workerRescue } from '@helpers/worker/worker-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type {
  CollectibleContent,
  Combat,
  EquipmentContent,
  ItemContent,
  ItemId,
  RecipeContent,
  ResolvedDrop,
  WorkerContent,
} from '@interfaces';

// `rewardContentInfo` only structurally checks for `itemId`/`equipmentId`/etc, so a `ResolvedDrop` satisfies it like a `RewardIdentity` would.
function emitRewardVfx(
  combat: Combat,
  drop: ResolvedDrop,
  quantity: number,
): void {
  const info = rewardContentInfo(drop);
  if (!info) return;

  gatherVfxEmit({ nodeName: combat.locationName, quantity, ...info });
}

// Shared by monster kill drops and encounter/encounter-random completion rewards (see `loot.ts`).
// A worker reward always rolls its chance but only ever grants once - the already-rescued check is here.
export function grantResolvedDrops(
  combat: Combat,
  drops: ResolvedDrop[],
): void {
  const itemsFound: Record<ItemId, number> = {};

  drops.forEach((drop) => {
    switch (drop.kind) {
      case 'Equipment': {
        armoryAdd(drop.equipmentId);

        const equipment = getEntry<EquipmentContent>(drop.equipmentId);
        if (!equipment) return;

        combatMessageLog(
          combat,
          `The party found ${equipmentDropHtml(equipment)}!`,
        );
        emitRewardVfx(combat, drop, 1);
        return;
      }

      case 'Collectible': {
        collectiblesAdd(drop.collectibleId, 1);

        const collectible = getEntry<CollectibleContent>(drop.collectibleId);
        if (!collectible) return;

        combatMessageLog(
          combat,
          `The party found ${collectibleDropHtml(collectible)}!`,
        );
        emitRewardVfx(combat, drop, 1);
        return;
      }

      case 'Recipe': {
        recipeDiscover(drop.recipeId);

        const recipe = getEntry<RecipeContent>(drop.recipeId);
        if (!recipe) return;

        combatMessageLog(combat, `The party found ${recipeDropHtml(recipe)}!`);
        emitRewardVfx(combat, drop, 1);
        return;
      }

      case 'Worker': {
        if (isWorkerRescued(drop.workerId)) return; // silent no-op, no duplicate

        workerRescue(drop.workerId);

        const worker = getEntry<WorkerContent>(drop.workerId);
        if (!worker) return;

        combatMessageLog(combat, `The party rescued ${worker.name}!`);
        emitRewardVfx(combat, drop, 1);
        return;
      }

      case 'Item': {
        itemsFound[drop.itemId] = (itemsFound[drop.itemId] ?? 0) + drop.quantity;
        return;
      }

      default:
        assertNeverReward(drop);
    }
  });

  Object.keys(itemsFound).forEach((itemId) => {
    const quantity = itemsFound[itemId as ItemId];
    if (quantity <= 0) return;

    addMaterial(itemId as ItemId, quantity);

    const item = getEntry<ItemContent>(itemId);
    if (!item) return;

    combatMessageLog(
      combat,
      `The party found ${itemDropHtml(item, quantity)}!`,
    );
    emitRewardVfx(combat, { kind: 'Item', itemId: itemId as ItemId, quantity }, quantity);
  });
}
