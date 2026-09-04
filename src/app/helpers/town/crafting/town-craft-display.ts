import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import type {
  RecipeContent,
  TownContent,
  TownCraftQueueRow,
  TownId,
  TownTradeskillLevelRow,
  TradeskillContent,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

export function townTradeskillLevelRows(townId: TownId): TownTradeskillLevelRow[] {
  const town = getEntry<TownContent>(townId);
  if (!town) return [];

  const state = gamestate().world.towns[townId];

  return ALL_TRADESKILLS.flatMap((tradeskillName) => {
    const content = getEntry<TradeskillContent>(tradeskillName);
    if (!content) return [];

    const building = state?.tradeskills[content.id];

    return [
      {
        tradeskillId: content.id,
        name: content.name,
        sprite: content.sprite,
        level: building?.level ?? 1,
        isSpecialty: content.id === town.crafting.specialtyTradeskillId,
      },
    ];
  });
}

export function townCraftQueueRows(townId: TownId): TownCraftQueueRow[] {
  const town = getEntry<TownContent>(townId);
  const state = gamestate().world.towns[townId];
  if (!town || !state) return [];

  return state.craftQueue.flatMap((entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    const tradeskill = getEntry<TradeskillContent>(entry.tradeskillId);
    if (!recipe || !tradeskill) return [];

    const craftTime = recipe.craftTime * town.crafting.craftingDurationMultiplier;

    return [
      {
        id: entry.id,
        tradeskillName: tradeskill.name,
        resultDisplay: resolveRewardDisplay(recipe.result),
        remaining: formatDuration(craftTime - entry.ticksIntoCraft),
      },
    ];
  });
}
