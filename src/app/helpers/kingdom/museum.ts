import { isTraderDiscovered } from '@helpers/caravan/caravan';
import { getEntriesByType } from '@helpers/content/content';
import { isMonsterDiscovered } from '@helpers/kingdom';
import { isTownVisited } from '@helpers/town/town-visit';
import { isWorldNodeMapVisited } from '@helpers/world-node/world-nodes';
import type {
  CaravanTraderContent,
  CollectibleSource,
  DropCollectible,
  DropEquipment,
  DropItem,
  DropRecipe,
  EncounterContent,
  EncounterRandomContent,
  EquipmentId,
  ExchangeNodeContent,
  ExchangeNodeExchange,
  GatheringContent,
  ItemId,
  MonsterContent,
  RecipeContent,
  RecipeId,
  TownContent,
} from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

// Drops, trades, recipe results, gather results and town sales all name their output with these same fields, so one matcher covers every channel.
const SOURCE_KEYS = [
  'itemId',
  'equipmentId',
  'recipeId',
  'collectibleId',
] as const;
type SourceKey = (typeof SOURCE_KEYS)[number];
type SourceFields = Partial<Record<SourceKey, string>>;

export type SourceTarget =
  DropItem | DropEquipment | DropRecipe | DropCollectible;

// Takes `object` rather than SourceFields: a worker drop shares none of these keys, which TS would reject as a weak-type mismatch.
function matchesTarget(output: object, target: SourceTarget): boolean {
  const fields = output as SourceFields;
  const wanted = target as SourceFields;
  return SOURCE_KEYS.some(
    (key) => wanted[key] !== undefined && fields[key] === wanted[key],
  );
}

// Exchanges name their output per kind - normalize to the shared field names.
function exchangeOutput(exchange: ExchangeNodeExchange): SourceFields {
  return exchange.kind === 'Item'
    ? { itemId: exchange.output.itemId }
    : { equipmentId: exchange.outputEquipmentId };
}

// Town-unique recipes are never on the player's craft list - credit the town whose shop sells the output instead.
function recipeCraftSource(
  recipe: RecipeContent,
  towns: TownContent[],
): CollectibleSource[] {
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
}

function sourceKey(source: CollectibleSource): string {
  return source.type === 'crafting'
    ? `crafting:${source.tradeskillId}:${source.tradeskillLevel}`
    : `${source.type}:${source.name}`;
}

// The entries whose outputs include the target, each turned into the source(s) it represents.
function sourcesFrom<T>(
  target: SourceTarget,
  entries: T[],
  outputsOf: (entry: T) => object[],
  toSource: (entry: T) => CollectibleSource | CollectibleSource[],
): CollectibleSource[] {
  return entries
    .filter((entry) =>
      outputsOf(entry).some((output) => matchesTarget(output, target)),
    )
    .flatMap((entry) => toSource(entry));
}

const nodeSource = (entry: { name: string }): CollectibleSource => ({
  type: 'node',
  name: entry.name,
});

export function contentSources(target: SourceTarget): CollectibleSource[] {
  const towns = getEntriesByType<TownContent>('town');
  const encounters = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];

  return uniqBy(
    [
      ...sourcesFrom(
        target,
        getEntriesByType<GatheringContent>('gathering'),
        (gather) => gather.gatherResults.flatMap((result) => result.items),
        nodeSource,
      ),
      ...sourcesFrom(
        target,
        encounters,
        (encounter) => encounter.completionRewards,
        nodeSource,
      ),
      // 'buy' trades are the trader buying from the party - not a source.
      ...sourcesFrom(
        target,
        getEntriesByType<CaravanTraderContent>('caravantrader'),
        (trader) => [
          ...trader.trades.filter((trade) => trade.type === 'sell'),
          ...trader.tokenTrades,
        ],
        (trader) => ({
          type: 'trader',
          traderId: trader.id,
          name: trader.name,
        }),
      ),
      ...sourcesFrom(
        target,
        getEntriesByType<RecipeContent>('recipe'),
        (recipe) => [recipe.result],
        (recipe) => recipeCraftSource(recipe, towns),
      ),
      ...sourcesFrom(
        target,
        towns,
        (town) => town.materialThresholds.filter((sale) => sale.value > 0),
        (town) => ({ type: 'town', townId: town.id, name: town.name }),
      ),
      ...sourcesFrom(
        target,
        towns,
        (town) => town.defense.rewards,
        (town) => ({ type: 'raid', townId: town.id, name: town.name }),
      ),
      ...sourcesFrom(
        target,
        getEntriesByType<ExchangeNodeContent>('exchangenode'),
        (exchange) => exchange.exchanges.map(exchangeOutput),
        nodeSource,
      ),
      ...sourcesFrom(
        target,
        getEntriesByType<MonsterContent>('monster'),
        (monster) => monster.drops,
        (monster) => ({
          type: 'monster',
          name: monster.name,
          monsterId: monster.id,
        }),
      ),
    ],
    sourceKey,
  );
}

export function itemSources(itemId: ItemId): CollectibleSource[] {
  return contentSources({ itemId });
}

export function equipmentSources(
  equipmentId: EquipmentId,
): CollectibleSource[] {
  return contentSources({ equipmentId });
}

export function recipeSources(recipeId: RecipeId): CollectibleSource[] {
  return contentSources({ recipeId });
}

// Whether the player has been where this source is, so naming it can't spoil anything.
export function isCollectibleSourceKnown(source: CollectibleSource): boolean {
  switch (source.type) {
    case 'node':
      return isWorldNodeMapVisited(source.name);
    case 'trader':
      return isTraderDiscovered(source.traderId);
    case 'raid':
    case 'town':
      return isTownVisited(source.townId);
    case 'crafting':
      return true;
    case 'monster':
      return isMonsterDiscovered(source.monsterId);
  }
}
