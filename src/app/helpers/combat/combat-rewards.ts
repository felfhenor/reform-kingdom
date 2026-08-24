import {
  collectibleDropHtml,
  combatMessageLog,
  equipmentDropHtml,
  itemDropHtml,
  recipeDropHtml,
} from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import { recipeDiscover } from '@helpers/crafting/recipes';
import { collectiblesAdd } from '@helpers/item/collectibles';
import { addMaterial } from '@helpers/item/materials';
import { armoryAdd } from '@helpers/kingdom/armory';
import type {
  CollectibleContent,
  Combat,
  EquipmentContent,
  ItemContent,
  ItemId,
  RecipeContent,
  ResolvedDrop,
} from '@interfaces';

// Shared by monster kill drops, encounter completion rewards, and
// encounter-random completion rewards - all of which roll from the same
// `DroppedReward[]` schema (see `loot.ts`).
export function grantResolvedDrops(
  combat: Combat,
  drops: ResolvedDrop[],
): void {
  const itemsFound: Record<ItemId, number> = {};

  drops.forEach((drop) => {
    if ('equipmentId' in drop) {
      armoryAdd(drop.equipmentId);

      const equipment = getEntry<EquipmentContent>(drop.equipmentId);
      if (!equipment) return;

      combatMessageLog(
        combat,
        `The party found ${equipmentDropHtml(equipment)}!`,
      );
      return;
    }

    if ('collectibleId' in drop) {
      collectiblesAdd(drop.collectibleId, 1);

      const collectible = getEntry<CollectibleContent>(drop.collectibleId);
      if (!collectible) return;

      combatMessageLog(
        combat,
        `The party found ${collectibleDropHtml(collectible)}!`,
      );
      return;
    }

    if ('recipeId' in drop) {
      recipeDiscover(drop.recipeId);

      const recipe = getEntry<RecipeContent>(drop.recipeId);
      if (!recipe) return;

      combatMessageLog(combat, `The party found ${recipeDropHtml(recipe)}!`);
      return;
    }

    itemsFound[drop.itemId] = (itemsFound[drop.itemId] ?? 0) + drop.quantity;
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
  });
}
