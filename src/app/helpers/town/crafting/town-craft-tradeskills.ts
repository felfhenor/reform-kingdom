import { getEntriesByType, getEntry } from '@helpers/content/content';
import { tradeskillXpForLevel } from '@helpers/crafting/tradeskill';
import type {
  RecipeContent,
  TownContent,
  TownCraftQueueEntry,
  TownId,
  TownTradeskillState,
  TradeskillContent,
  TradeskillId,
} from '@interfaces';

function seedLevelFor(town: TownContent, tradeskillId: TradeskillId): number {
  return (
    town.crafting.tradeskillLevels.find(
      (seed) => seed.tradeskillId === tradeskillId,
    )?.level ?? 1
  );
}

function buildingAtLevel(level: number): TownTradeskillState {
  return { level, xp: { current: 0, maximum: tradeskillXpForLevel(level) } };
}

// Backfills any missing tradeskill entry and floors every tradeskill at its content-authored seed level.
export function townTradeskillsMaterialize(
  townId: TownId,
  existing: Record<TradeskillId, TownTradeskillState>,
): Record<TradeskillId, TownTradeskillState> {
  const town = getEntry<TownContent>(townId);
  if (!town) return existing;

  const materialized = { ...existing };

  getEntriesByType<TradeskillContent>('tradeskill').forEach((tradeskill) => {
    const seedLevel = seedLevelFor(town, tradeskill.id);
    const current = materialized[tradeskill.id];

    if (!current || current.level < seedLevel) {
      materialized[tradeskill.id] = buildingAtLevel(seedLevel);
    }
  });

  return materialized;
}

// Drops entries whose tradeskillId no longer resolves (mirrors pruneInvalidTownStock).
export function pruneInvalidTownTradeskills(
  tradeskills: Record<TradeskillId, TownTradeskillState>,
): Record<TradeskillId, TownTradeskillState> {
  const pruned: Record<TradeskillId, TownTradeskillState> = {};

  (Object.keys(tradeskills) as TradeskillId[]).forEach((tradeskillId) => {
    if (getEntry<TradeskillContent>(tradeskillId)) {
      pruned[tradeskillId] = tradeskills[tradeskillId];
    }
  });

  return pruned;
}

// Lives here, not town-craft-queue.ts, to avoid a cycle - town-tick.ts needs this but is imported by town-craft-queue.ts.
export function pruneInvalidTownCraftQueue(
  queue: TownCraftQueueEntry[],
): TownCraftQueueEntry[] {
  return queue.filter(
    (entry) =>
      !!getEntry<TradeskillContent>(entry.tradeskillId) &&
      !!getEntry<RecipeContent>(entry.recipeId),
  );
}
