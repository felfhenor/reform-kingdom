import { getEntriesByType } from '@helpers/content/content';
import type {
  CaravanTraderContent,
  EncounterContent,
  RecipeId,
} from '@interfaces';

export function recipeSourceNodeNames(recipeId: RecipeId): string[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');

  const names = new Set<string>();
  encounters.forEach((encounter) => {
    const dropsHere = encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    );
    if (dropsHere) names.add(encounter.name);
  });

  traders.forEach((trader) => {
    const soldHere =
      trader.trades.some((trade) => trade.recipeId === recipeId) ||
      trader.tokenTrades.some((trade) => trade.recipeId === recipeId);
    if (soldHere) names.add(trader.name);
  });

  return [...names];
}
