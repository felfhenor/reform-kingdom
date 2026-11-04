import { isTraderDiscovered } from '@helpers/caravan/caravan';
import { getEntriesByType } from '@helpers/content/content';
import { isMonsterDiscovered } from '@helpers/kingdom';
import { townMaterialSaleConfig } from '@helpers/town';
import { isTownVisited } from '@helpers/town/town-visit';
import { isWorldNodeMapVisited } from '@helpers/world-node/world-nodes';
import type {
  CaravanTraderContent,
  CollectibleSource,
  EncounterContent,
  EncounterRandomContent,
  EquipmentId,
  ExchangeNodeContent,
  GatheringContent,
  ItemId,
  MonsterContent,
  RecipeContent,
  RecipeId,
  TownContent,
} from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

function recipeCraftSources(
  recipes: RecipeContent[],
  towns: TownContent[],
): CollectibleSource[] {
  return recipes.flatMap((recipe): CollectibleSource[] => {
    const owningTowns = towns.filter((town) =>
      town.crafting.uniqueRecipeIds.includes(recipe.id),
    );
    if (owningTowns.length === 0) {
      return [
        {
          type: 'crafting',
          tradeskillId: recipe.tradeskillId,
          tradeskillLevel: recipe.minTradeskillLevel,
        },
      ];
    }

    return owningTowns.map((town) => ({
      type: 'town',
      townId: town.id,
      name: town.name,
    }));
  });
}

function sourceKey(source: CollectibleSource): string {
  return source.type === 'crafting'
    ? `crafting:${source.tradeskillId}:${source.tradeskillLevel}`
    : `${source.type}:${source.name}`;
}

export function itemSources(itemId: ItemId): CollectibleSource[] {
  const gathers = getEntriesByType<GatheringContent>('gathering');
  const encounters = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];
  const monsters = getEntriesByType<MonsterContent>('monster');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const exchanges = getEntriesByType<ExchangeNodeContent>('exchangenode');
  const towns = getEntriesByType<TownContent>('town');

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

  const dropSources: CollectibleSource[] = encounters
    .filter((encounter) =>
      encounter.completionRewards.some(
        (reward) => 'itemId' in reward && reward.itemId === itemId,
      ),
    )
    .map((encounter) => ({ type: 'node', name: encounter.name }));

  // 'buy' trades are the trader buying from the party - not a source.
  const traderSources: CollectibleSource[] = traders
    .filter(
      (trader) =>
        trader.trades.some(
          (trade) => trade.type === 'sell' && trade.itemId === itemId,
        ) || trader.tokenTrades.some((trade) => trade.itemId === itemId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  const craftingSources = recipeCraftSources(
    recipes.filter(
      (recipe) => 'itemId' in recipe.result && recipe.result.itemId === itemId,
    ),
    towns,
  );

  const townSaleSources: CollectibleSource[] = towns
    .filter((town) => !!townMaterialSaleConfig(town, itemId))
    .map((town) => ({ type: 'town', townId: town.id, name: town.name }));

  const raidSources: CollectibleSource[] = towns
    .filter((town) =>
      town.defense.rewards.some(
        (reward) => 'itemId' in reward && reward.itemId === itemId,
      ),
    )
    .map((town) => ({ type: 'raid', townId: town.id, name: town.name }));

  return uniqBy(
    [
      ...gatherSources,
      ...dropSources,
      ...traderSources,
      ...craftingSources,
      ...townSaleSources,
      ...raidSources,
      ...exchangeSources,
      ...monsterSources,
    ],
    sourceKey,
  );
}

export function equipmentSources(
  equipmentId: EquipmentId,
): CollectibleSource[] {
  const encounters = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];
  const monsters = getEntriesByType<MonsterContent>('monster');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const exchanges = getEntriesByType<ExchangeNodeContent>('exchangenode');
  const towns = getEntriesByType<TownContent>('town');

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
        trader.trades.some(
          (trade) => trade.type === 'sell' && trade.equipmentId === equipmentId,
        ) ||
        trader.tokenTrades.some((trade) => trade.equipmentId === equipmentId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  const craftingSources: CollectibleSource[] = recipeCraftSources(
    recipes.filter(
      (recipe) =>
        'equipmentId' in recipe.result &&
        recipe.result.equipmentId === equipmentId,
    ),
    towns,
  );

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
    case 'town':
      return isTownVisited(source.townId);
    case 'crafting':
      return true;
    case 'monster':
      return isMonsterDiscovered(source.monsterId);
  }
}
