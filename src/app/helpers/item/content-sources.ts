import { allContentById, getEntriesByType } from '@helpers/content/content';
import type {
  CaravanTraderContent,
  CollectibleSource,
  ContentSourceCache,
  EncounterContent,
  EncounterRandomContent,
  ExchangeNodeContent,
  ExchangeNodeExchange,
  GatheringContent,
  MonsterContent,
  RecipeContent,
  SourceFields,
  SourceTarget,
  TaskContent,
  TownContent,
} from '@interfaces';
import { SOURCE_KEYS } from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

// Takes `object` rather than SourceFields: a worker drop shares none of these keys, which TS would reject as a weak-type mismatch.
export function sourceMatchesTarget(
  output: object,
  target: SourceTarget,
): boolean {
  const fields = output as SourceFields;
  const wanted = target as SourceFields;
  return SOURCE_KEYS.some(
    (key) => wanted[key] !== undefined && fields[key] === wanted[key],
  );
}

// Takes `object` so recipe results key the same way as drop targets.
export function sourceTargetKey(target: object): string {
  const fields = target as SourceFields;
  const key = SOURCE_KEYS.find((candidate) => fields[candidate] !== undefined);
  return key ? `${key}:${fields[key]}` : '';
}

// Town-unique recipes are never on the player's craft list - credit the town whose crafting stocks the output instead.
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
    type: 'townCraft',
    townId: town.id,
    name: town.name,
    isEquipment: 'equipmentId' in recipe.result,
  }));
}

export function sourceKey(source: CollectibleSource): string {
  return source.type === 'crafting'
    ? `crafting:${source.tradeskillId}:${source.tradeskillLevel}`
    : `${source.type}:${source.name}`;
}

// Exchanges at one node stay apart when they consume different things.
export function sourceUniqueKey(source: CollectibleSource): string {
  const requires =
    source.type === 'node' ? (source.requires ?? []).map(sourceTargetKey) : [];
  return [sourceKey(source), ...requires].join(',');
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
      outputsOf(entry).some((output) => sourceMatchesTarget(output, target)),
    )
    .flatMap((entry) => toSource(entry));
}

export const nodeSource = (entry: { name: string }): CollectibleSource => ({
  type: 'node',
  name: entry.name,
});

function exchangeRequires(exchange: ExchangeNodeExchange): SourceTarget[] {
  const input = 'input' in exchange ? [exchange.input as SourceTarget] : [];
  return [...input, ...exchange.costs.map(({ itemId }) => ({ itemId }))];
}

// One source per matching exchange, carrying what it consumes.
function exchangeSources(target: SourceTarget): CollectibleSource[] {
  return getEntriesByType<ExchangeNodeContent>('exchangenode').flatMap((node) =>
    node.exchanges
      .filter((exchange) => sourceMatchesTarget(exchange.output, target))
      .map((exchange) => ({
        type: 'node' as const,
        name: node.name,
        requires: exchangeRequires(exchange),
      })),
  );
}

function worldSources(target: SourceTarget): CollectibleSource[] {
  const encounters = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];
  return [
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
    ...exchangeSources(target),
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
  ];
}

function tradeSources(target: SourceTarget): CollectibleSource[] {
  const towns = getEntriesByType<TownContent>('town');
  return [
    // 'buy' trades are the trader buying from the party - not a source.
    ...sourcesFrom(
      target,
      getEntriesByType<CaravanTraderContent>('caravantrader'),
      (trader) => [
        ...trader.trades.filter((trade) => trade.type === 'sell'),
        ...trader.tokenTrades,
      ],
      (trader) => ({ type: 'trader', traderId: trader.id, name: trader.name }),
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
      getEntriesByType<TaskContent>('task'),
      (task) => task.rewards,
      (task) => ({ type: 'task', taskId: task.id, name: task.name }),
    ),
  ];
}

let contentSourceCache: ContentSourceCache | undefined;

// Static content only, so it ignores this run's edicts; cached per target until content reloads.
export function baseContentSources(target: SourceTarget): CollectibleSource[] {
  const content = allContentById();
  if (contentSourceCache?.content !== content) {
    contentSourceCache = { content, byTarget: new Map() };
  }

  const key = sourceTargetKey(target);
  const cached = contentSourceCache.byTarget.get(key);
  if (cached) return cached;

  const sources = uniqBy(
    [...worldSources(target), ...tradeSources(target)],
    sourceUniqueKey,
  );
  contentSourceCache.byTarget.set(key, sources);
  return sources;
}

// Farmable without limit; tasks, raids, exchanges and town stock (only restocked by gathering, never crafting) aren't.
export function isRepeatableSource(source: CollectibleSource): boolean {
  if (source.type === 'node') return !source.requires;
  return source.type === 'monster' || source.type === 'trader';
}

// Only ever made by the player's own crafting, so nothing else keeps it coming.
export function isCraftedOnly(target: SourceTarget): boolean {
  const sources = baseContentSources(target);
  return (
    sources.some((source) => source.type === 'crafting') &&
    !sources.some(isRepeatableSource)
  );
}
