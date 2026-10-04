/**
 * Collates "when can a player first obtain this item" across every source
 * channel (monster drops, node completion rewards, gathering, tradeskill
 * crafting, caravan trades, commission rewards).
 */

import { getEntry } from '@helpers/content/content';
import type {
  AnalysisItemSource,
  CaravanContent,
  CaravanTraderContent,
  CommissionOfferContent,
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  LevelRange,
  MonsterContent,
  RecipeContent,
  TownContent,
} from '@interfaces';
import { max, min, minBy } from 'es-toolkit/compat';

function noteSpawn(
  spawns: Map<string, LevelRange[]>,
  monsterId?: string,
  range?: LevelRange,
): void {
  if (!monsterId || !range) return;

  spawns.set(monsterId, [...(spawns.get(monsterId) ?? []), range]);
}

function townSpawns(
  spawns: Map<string, LevelRange[]>,
  town: TownContent,
): void {
  const { assaulter, guardian } = town.defense;
  const assaulterLevel = { min: assaulter.level.max, max: assaulter.level.max };
  const guardianLevel = { min: town.level, max: town.level };

  assaulter.monsterIds.forEach((id) => noteSpawn(spawns, id, assaulterLevel));
  guardian.reputationTiers
    .flatMap((tier) => tier.guardians)
    .forEach((entry) => noteSpawn(spawns, entry.monsterId, guardianLevel));
}

// Each entry is one place the monster actually spawns, so skill level gates can be checked per window rather than over a lossy min-max hull.
export function buildMonsterSpawnRanges(
  encounters: EncounterContent[],
  encounterRandoms: EncounterRandomContent[],
  towns: TownContent[] = [],
): Map<string, LevelRange[]> {
  const spawns = new Map<string, LevelRange[]>();

  encounters.forEach((encounter) => {
    encounter.fights.forEach((fight) => {
      fight.monsters.forEach((m) =>
        noteSpawn(spawns, m.monsterId, encounter.levelRange),
      );
    });
  });
  encounterRandoms.forEach((encounter) => {
    encounter.fights.forEach((fight) => {
      fight.monsters.forEach((m) =>
        noteSpawn(spawns, m.monsterId, encounter.levelRange),
      );
    });
    encounter.creaturePool.forEach((m) =>
      noteSpawn(spawns, m.monsterId, encounter.levelRange),
    );
  });
  towns.forEach((town) => townSpawns(spawns, town));

  return spawns;
}

export function buildMonsterLevels(
  encounters: EncounterContent[],
  encounterRandoms: EncounterRandomContent[],
): Map<string, LevelRange> {
  const spawns = buildMonsterSpawnRanges(encounters, encounterRandoms);

  return new Map(
    [...spawns].map(([monsterId, ranges]) => [
      monsterId,
      {
        min: min(ranges.map((r) => r.min)) ?? 0,
        max: max(ranges.map((r) => r.max)) ?? 0,
      },
    ]),
  );
}

function addSource(
  itemSources: Map<string, AnalysisItemSource[]>,
  description: string,
  itemId?: string,
  level?: number,
): void {
  if (!itemId || level === undefined || !Number.isFinite(level)) return;

  const list = itemSources.get(itemId) ?? [];
  list.push({ level, description });
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
  towns: TownContent[] = [],
): Map<string, AnalysisItemSource[]> {
  const itemSources = new Map<string, AnalysisItemSource[]>();

  monsters.forEach((monster) => {
    const level = monsterLevels.get(monster.id)?.min;
    monster.drops.forEach((drop) => {
      if ('itemId' in drop) {
        addSource(itemSources, `monster "${monster.name}"`, drop.itemId, level);
      }
    });
  });

  [...encounters, ...encounterRandoms].forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if ('itemId' in reward) {
        addSource(
          itemSources,
          `encounter "${encounter.name}"`,
          reward.itemId,
          encounter.levelRange?.min,
        );
      }
    });
  });

  towns.forEach((town) => {
    town.defense.rewards.forEach((reward) => {
      if ('itemId' in reward) {
        addSource(
          itemSources,
          `town defense "${town.name}"`,
          reward.itemId,
          town.defense.assaulter.level.min,
        );
      }
    });
  });

  gatherings.forEach((gathering) => {
    gathering.gatherResults.forEach((result) => {
      result.items.forEach((resultItem) =>
        addSource(
          itemSources,
          `gathering node "${gathering.name}"`,
          resultItem.itemId,
          gathering.levelRange?.min,
        ),
      );
    });
  });

  recipes.forEach((recipe) => {
    if ('itemId' in recipe.result) {
      addSource(
        itemSources,
        `recipe "${recipe.name}"`,
        recipe.result.itemId,
        recipe.minTradeskillLevel,
      );
    }
  });

  // A commission's reward has no level of its own - attributed to the caravan offering it.
  caravans.forEach((caravan) => {
    caravan.commissionOffers.forEach((slot) => {
      const offer = getEntry<CommissionOfferContent>(slot.commissionOfferId);
      offer?.rewards.forEach((reward) => {
        if ('itemId' in reward) {
          addSource(
            itemSources,
            `commission "${offer.name}"`,
            reward.itemId,
            caravan.level.min,
          );
        }
      });
    });
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
        addSource(
          itemSources,
          `caravan trader "${trader.name}"`,
          trade.itemId,
          caravan.level.min,
        ),
      );
    });
  });

  return itemSources;
}

export function earliestSource(
  itemSources: Map<string, AnalysisItemSource[]>,
  itemId: string,
): AnalysisItemSource | undefined {
  return minBy(itemSources.get(itemId) ?? [], (s) => s.level);
}

export function earliestLevel(
  itemSources: Map<string, AnalysisItemSource[]>,
  itemId: string,
): number | undefined {
  return earliestSource(itemSources, itemId)?.level;
}
