/**
 * Collates "when can a player first obtain this item" across every source
 * channel (monster drops, node completion rewards, gathering, tradeskill
 * crafting, caravan trades) - shared by `analysis-contentgaps.ts`, the only
 * script that needs a per-item earliest-obtainable-level.
 */

import type {
  AnalysisItemSource,
  CaravanContent,
  CaravanTraderContent,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  LevelRange,
  MonsterContent,
  RecipeContent,
} from '@interfaces';

function noteMonsterLevel(
  monsterLevels: Map<string, LevelRange>,
  monsterId: string | undefined,
  range: LevelRange | undefined,
): void {
  if (!monsterId || !range) return;

  const existing = monsterLevels.get(monsterId);
  if (!existing) {
    monsterLevels.set(monsterId, { min: range.min, max: range.max });
    return;
  }

  existing.min = Math.min(existing.min, range.min);
  existing.max = Math.max(existing.max, range.max);
}

export function buildMonsterLevels(
  encounters: EncounterContent[],
  encounterRandoms: EncounterRandomContent[],
): Map<string, LevelRange> {
  const monsterLevels = new Map<string, LevelRange>();

  encounters.forEach((encounter) => {
    encounter.fights.forEach((fight) => {
      fight.monsters.forEach((m) =>
        noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
      );
    });
  });
  encounterRandoms.forEach((encounter) => {
    encounter.fights.forEach((fight) => {
      fight.monsters.forEach((m) =>
        noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
      );
    });
    encounter.creaturePool.forEach((m) =>
      noteMonsterLevel(monsterLevels, m.monsterId, encounter.levelRange),
    );
  });

  return monsterLevels;
}

function addSource(
  itemSources: Map<string, AnalysisItemSource[]>,
  itemId: string | undefined,
  level: number | undefined,
): void {
  if (!itemId || level === undefined || !Number.isFinite(level)) return;

  const list = itemSources.get(itemId) ?? [];
  list.push({ level });
  itemSources.set(itemId, list);
}

export function buildItemSources(
  monsters: MonsterContent[],
  encounters: EncounterContent[],
  encounterRandoms: EncounterRandomContent[],
  gatherings: GatheringContent[],
  recipes: RecipeContent[],
  caravans: CaravanContent[],
  caravanTraders: CaravanTraderContent[],
  monsterLevels: Map<string, LevelRange>,
): Map<string, AnalysisItemSource[]> {
  const itemSources = new Map<string, AnalysisItemSource[]>();

  monsters.forEach((monster) => {
    const level = monsterLevels.get(monster.id)?.min;
    monster.drops.forEach((drop) => {
      if ('itemId' in drop) addSource(itemSources, drop.itemId, level);
    });
  });

  [...encounters, ...encounterRandoms].forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if ('itemId' in reward) {
        addSource(itemSources, reward.itemId, encounter.levelRange?.min);
      }
    });
  });

  gatherings.forEach((gathering) => {
    gathering.gatherResults.forEach((result) => {
      result.items.forEach((resultItem) =>
        addSource(itemSources, resultItem.itemId, gathering.levelRange?.min),
      );
    });
  });

  recipes.forEach((recipe) => {
    if ('itemId' in recipe.result) {
      addSource(itemSources, recipe.result.itemId, recipe.minTradeskillLevel);
    }
  });

  caravanTraders.forEach((trader) => {
    const eligibleCaravans = caravans.filter(
      (caravan) =>
        caravan.traderCategories.includes(trader.category) &&
        trader.level >= caravan.level.min &&
        trader.level <= caravan.level.max,
    );

    trader.trades.forEach((trade) => {
      if (trade.type !== 'sell' || !trade.itemId) return;
      eligibleCaravans.forEach((caravan) =>
        addSource(itemSources, trade.itemId, caravan.level.min),
      );
    });
  });

  return itemSources;
}

export function earliestLevel(
  itemSources: Map<string, AnalysisItemSource[]>,
  itemId: string,
): number | undefined {
  const sources = itemSources.get(itemId);
  if (!sources || sources.length === 0) return undefined;
  return Math.min(...sources.map((s) => s.level));
}
