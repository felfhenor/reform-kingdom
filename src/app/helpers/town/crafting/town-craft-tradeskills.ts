import { getEntriesByType, getEntry } from '@helpers/content/content';
import { TRADESKILL_MAX_LEVEL } from '@helpers/crafting/tradeskill';
import { clamp } from 'es-toolkit/compat';
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
  return { level: clamp(level, 1, TRADESKILL_MAX_LEVEL) };
}

// A town's tradeskill level is fixed, content-authored data - always synced to the current seed rather than accumulated.
export function townTradeskillsMaterialize(
  townId: TownId,
  existing: Record<TradeskillId, TownTradeskillState>,
): Record<TradeskillId, TownTradeskillState> {
  const town = getEntry<TownContent>(townId);
  if (!town) return existing;

  const materialized = { ...existing };

  getEntriesByType<TradeskillContent>('tradeskill').forEach((tradeskill) => {
    materialized[tradeskill.id] = buildingAtLevel(
      seedLevelFor(town, tradeskill.id),
    );
  });

  return materialized;
}

// Drops entries whose tradeskillId no longer resolves.
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

export function pruneInvalidTownCraftQueue(
  queue: TownCraftQueueEntry[],
): TownCraftQueueEntry[] {
  return queue.filter(
    (entry) =>
      !!getEntry<TradeskillContent>(entry.tradeskillId) &&
      !!getEntry<RecipeContent>(entry.recipeId),
  );
}
