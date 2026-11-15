import type {
  CaravanTraderContent,
  CommissionOfferContent,
  DroppedReward,
  EncounterContent,
  EncounterRandomContent,
  ExchangeNodeContent,
  GatheringContent,
  JobContent,
  MonsterContent,
  ObtainabilityEntriesOf,
  ObtainabilitySources,
  RecipeContent,
  TaskContent,
  TownContent,
} from '@interfaces';

function addIfPresent(set: Set<string>, value?: string): void {
  if (value) set.add(value);
}

function sourcesAddRewards(
  sources: ObtainabilitySources,
  rewards: DroppedReward[],
): void {
  rewards.forEach((reward) => {
    if ('itemId' in reward) addIfPresent(sources.items, reward.itemId);
    if ('equipmentId' in reward)
      addIfPresent(sources.equipment, reward.equipmentId);
    if ('collectibleId' in reward)
      addIfPresent(sources.collectibles, reward.collectibleId);
    if ('workerId' in reward) addIfPresent(sources.workers, reward.workerId);
  });
}

function sourcesAddCombat(
  sources: ObtainabilitySources,
  entriesOf: ObtainabilityEntriesOf,
): void {
  entriesOf<MonsterContent>('monster').forEach((monster) =>
    sourcesAddRewards(sources, monster.drops),
  );
  [
    ...entriesOf<EncounterContent>('encounter'),
    ...entriesOf<EncounterRandomContent>('encounterrandom'),
  ].forEach((encounter) =>
    sourcesAddRewards(sources, encounter.completionRewards),
  );
  entriesOf<TownContent>('town').forEach((town) => {
    sourcesAddRewards(sources, town.defense.rewards);
    // Town-referenced workers are obtained by working for that town.
    town.gathering.workers.forEach((worker) =>
      addIfPresent(sources.workers, worker.workerId),
    );
  });
}

function sourcesAddProgress(
  sources: ObtainabilitySources,
  entriesOf: ObtainabilityEntriesOf,
): void {
  entriesOf<JobContent>('job').forEach((job) =>
    job.starterEquipmentIds.forEach((id) => sources.equipment.add(id)),
  );
  entriesOf<CommissionOfferContent>('commissionoffer').forEach((offer) =>
    sourcesAddRewards(sources, offer.rewards),
  );
  entriesOf<TaskContent>('task').forEach((task) =>
    task.rewards.forEach((reward) =>
      addIfPresent(sources.items, reward.itemId),
    ),
  );
}

function sourcesAddCrafting(
  sources: ObtainabilitySources,
  entriesOf: ObtainabilityEntriesOf,
): void {
  entriesOf<GatheringContent>('gathering').forEach((gathering) =>
    gathering.gatherResults.forEach((result) =>
      result.items.forEach((item) => addIfPresent(sources.items, item.itemId)),
    ),
  );
  entriesOf<RecipeContent>('recipe').forEach((recipe) => {
    const result = recipe.result;
    if ('itemId' in result) addIfPresent(sources.items, result.itemId);
    if ('equipmentId' in result)
      addIfPresent(sources.equipment, result.equipmentId);
    if ('collectibleId' in result)
      addIfPresent(sources.collectibles, result.collectibleId);
  });
}

function sourcesAddTrades(
  sources: ObtainabilitySources,
  entriesOf: ObtainabilityEntriesOf,
): void {
  entriesOf<CaravanTraderContent>('caravantrader').forEach((trader) =>
    [
      ...trader.trades.filter((trade) => trade.type === 'sell'),
      ...(trader.tokenTrades ?? []),
    ].forEach((trade) => {
      addIfPresent(sources.items, trade.itemId);
      addIfPresent(sources.equipment, trade.equipmentId);
      addIfPresent(sources.collectibles, trade.collectibleId);
    }),
  );
  entriesOf<ExchangeNodeContent>('exchangenode').forEach((node) =>
    node.exchanges.forEach((exchange) => {
      if (exchange.kind === 'Equipment')
        addIfPresent(sources.equipment, exchange.output.equipmentId);
      else if (exchange.kind === 'Collectible')
        addIfPresent(sources.collectibles, exchange.output.collectibleId);
      else addIfPresent(sources.items, exchange.output.itemId);
    }),
  );
}

export function obtainabilitySources(
  entriesOf: ObtainabilityEntriesOf,
): ObtainabilitySources {
  const sources: ObtainabilitySources = {
    items: new Set(),
    equipment: new Set(),
    collectibles: new Set(),
    workers: new Set(),
  };
  sourcesAddCombat(sources, entriesOf);
  sourcesAddProgress(sources, entriesOf);
  sourcesAddCrafting(sources, entriesOf);
  sourcesAddTrades(sources, entriesOf);
  return sources;
}
