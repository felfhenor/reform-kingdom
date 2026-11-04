import { isTraderDiscovered } from '@helpers/caravan/caravan';
import { getEntriesByType } from '@helpers/content/content';
import { isMonsterDiscovered } from '@helpers/kingdom';
import { isTownVisited } from '@helpers/town/town-visit';
import { isWorldNodeMapVisited } from '@helpers/world-node/world-nodes';
import type {
  CaravanTraderContent,
  CollectibleSource,
  EncounterContent,
  EquipmentId,
  ExchangeNodeContent,
  GatheringContent,
  ItemId,
  MonsterContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

export function itemSources(itemId: ItemId): CollectibleSource[] {
  const gathers = getEntriesByType<GatheringContent>('gathering');
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const exchanges = getEntriesByType<ExchangeNodeContent>('exchangenode');

  const exchangeSources: CollectibleSource[] = exchanges
    .filter((exchange) =>
      exchange.exchanges.some(
        (reward) => reward.kind === 'Item' && reward.output.itemId === itemId,
      ),
    )
    .map((exchange) => ({ type: 'node', name: exchange.name }));

  const gatherSources: CollectibleSource[] = gathers
    .filter((gather) =>
      gather.gatherResults.some((reward) =>
        reward.items.some((item) => item.itemId === itemId),
      ),
    )
    .map((gather) => ({ type: 'node', name: gather.name }));

  const monsterSources: CollectibleSource[] = monsters
    .filter((monster) =>
      monster.drops.some(
        (reward) => 'itemId' in reward && reward.itemId === itemId,
      ),
    )
    .map((monster) => ({
      type: 'monster',
      name: monster.name,
      monsterId: monster.id,
    }));

  const dropEncounters = encounters.filter((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'itemId' in reward && reward.itemId === itemId,
    ),
  );

  const dropSources: CollectibleSource[] = uniqBy(dropEncounters, 'name').map(
    (encounter) => ({ type: 'node', name: encounter.name }),
  );

  const traderSources: CollectibleSource[] = traders
    .filter(
      (trader) =>
        trader.trades.some((trade) => trade.itemId === itemId) ||
        trader.tokenTrades.some((trade) => trade.itemId === itemId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  const craftingSources: CollectibleSource[] = recipes
    .filter(
      (recipe) => 'itemId' in recipe.result && recipe.result.itemId === itemId,
    )
    .map((recipe) => ({
      type: 'crafting',
      tradeskillId: recipe.tradeskillId,
      tradeskillLevel: recipe.minTradeskillLevel,
    }));

  return [
    ...gatherSources,
    ...dropSources,
    ...traderSources,
    ...craftingSources,
    ...exchangeSources,
    ...monsterSources,
  ];
}

export function equipmentSources(
  equipmentId: EquipmentId,
): CollectibleSource[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const monsters = getEntriesByType<MonsterContent>('monster');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const exchanges = getEntriesByType<ExchangeNodeContent>('exchangenode');

  const exchangeSources: CollectibleSource[] = exchanges
    .filter((exchange) =>
      exchange.exchanges.some(
        (reward) =>
          reward.kind === 'Equipment' &&
          reward.outputEquipmentId === equipmentId,
      ),
    )
    .map((exchange) => ({ type: 'node', name: exchange.name }));

  const monsterSources: CollectibleSource[] = monsters
    .filter((monster) =>
      monster.drops.some(
        (reward) =>
          'equipmentId' in reward && reward.equipmentId === equipmentId,
      ),
    )
    .map((monster) => ({
      type: 'monster',
      name: monster.name,
      monsterId: monster.id,
    }));

  const dropEncounters = encounters.filter((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'equipmentId' in reward && reward.equipmentId === equipmentId,
    ),
  );

  const dropSources: CollectibleSource[] = uniqBy(dropEncounters, 'name').map(
    (encounter) => ({ type: 'node', name: encounter.name }),
  );

  const traderSources: CollectibleSource[] = traders
    .filter(
      (trader) =>
        trader.trades.some((trade) => trade.equipmentId === equipmentId) ||
        trader.tokenTrades.some((trade) => trade.equipmentId === equipmentId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  const craftingSources: CollectibleSource[] = recipes
    .filter(
      (recipe) =>
        'equipmentId' in recipe.result &&
        recipe.result.equipmentId === equipmentId,
    )
    .map((recipe) => ({
      type: 'crafting',
      tradeskillId: recipe.tradeskillId,
      tradeskillLevel: recipe.minTradeskillLevel,
    }));

  return [
    ...dropSources,
    ...traderSources,
    ...craftingSources,
    ...exchangeSources,
    ...monsterSources,
  ];
}

export function recipeSources(recipeId: RecipeId): CollectibleSource[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');

  const dropEncounters = encounters.filter((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    ),
  );
  const dropSources: CollectibleSource[] = uniqBy(dropEncounters, 'name').map(
    (encounter) => ({ type: 'node', name: encounter.name }),
  );

  const traderSources: CollectibleSource[] = traders
    .filter(
      (trader) =>
        trader.trades.some((trade) => trade.recipeId === recipeId) ||
        trader.tokenTrades.some((trade) => trade.recipeId === recipeId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  return [...dropSources, ...traderSources];
}

// Whether the player has been where this source is, so naming it can't spoil anything.
export function isCollectibleSourceKnown(source: CollectibleSource): boolean {
  switch (source.type) {
    case 'node':
      return isWorldNodeMapVisited(source.name);
    case 'trader':
      return isTraderDiscovered(source.traderId);
    case 'raid':
      return isTownVisited(source.townId);
    case 'crafting':
      return true;
    case 'monster':
      return isMonsterDiscovered(source.monsterId);
  }
}
