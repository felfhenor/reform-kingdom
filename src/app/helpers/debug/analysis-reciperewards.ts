/**
 * Validates every `recipeId` reward across every droppable reward table
 * (monster drops, encounter/random-encounter completion rewards, town raid
 * defense rewards, commission offers): it must resolve to a real compiled
 * recipe, and it must not be a town-exclusive recipe (those are only ever
 * sold via a town's own crafting.uniqueRecipeIds shop stock - see
 * `isRecipeTownUnique` in `crafting/recipes.ts` - so a random drop of one is
 * always a content mistake, not an intended second source).
 */

import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CommissionOfferContent,
  DroppedReward,
  EncounterContent,
  EncounterRandomContent,
  MonsterContent,
  RecipeContent,
  TownContent,
} from '@interfaces';

type RecipeRewardSource = {
  id: string;
  label: string;
  rewards: DroppedReward[];
};

function recipeRewardSources(): RecipeRewardSource[] {
  const monsters = getEntriesByType<MonsterContent>('monster').map(
    (monster) => ({
      id: `monster:${monster.id}`,
      label: `Monster "${monster.name}"`,
      rewards: monster.drops,
    }),
  );

  const encounters = getEntriesByType<EncounterContent>('encounter').map(
    (encounter) => ({
      id: `encounter:${encounter.id}`,
      label: `Encounter "${encounter.name}"`,
      rewards: encounter.completionRewards,
    }),
  );

  const encounterRandoms = getEntriesByType<EncounterRandomContent>(
    'encounterrandom',
  ).map((encounter) => ({
    id: `encounterrandom:${encounter.id}`,
    label: `Random Encounter "${encounter.name}"`,
    rewards: encounter.completionRewards,
  }));

  const townRaids = getEntriesByType<TownContent>('town').map((town) => ({
    id: `town:${town.id}`,
    label: `Town "${town.name}" raid defense`,
    rewards: town.defense.rewards,
  }));

  const commissions = getEntriesByType<CommissionOfferContent>(
    'commissionoffer',
  ).map((offer) => ({
    id: `commissionoffer:${offer.id}`,
    label: `Commission "${offer.name}"`,
    rewards: offer.rewards,
  }));

  return [
    ...monsters,
    ...encounters,
    ...encounterRandoms,
    ...townRaids,
    ...commissions,
  ];
}

export function runRecipeRewardsAnalysis(): AnalysisRunResult {
  const recipeIds = new Set(
    getEntriesByType<RecipeContent>('recipe').map((r) => r.id),
  );
  const townUniqueRecipeIds = new Set(
    getEntriesByType<TownContent>('town').flatMap(
      (town) => town.crafting.uniqueRecipeIds,
    ),
  );

  const checks: AnalysisCheck[] = [];

  recipeRewardSources().forEach((source) => {
    source.rewards.forEach((reward) => {
      if (reward.kind !== 'Recipe') return;

      const id = `${source.id}:${reward.recipeId}`;

      if (!recipeIds.has(reward.recipeId)) {
        checks.push({
          id,
          label: source.label,
          status: 'fail',
          message: `${source.label} has a reward referencing recipeId "${reward.recipeId}", which doesn't resolve to any compiled recipe.`,
        });
        return;
      }

      if (townUniqueRecipeIds.has(reward.recipeId)) {
        checks.push({
          id,
          label: source.label,
          status: 'fail',
          message: `${source.label} rewards recipeId "${reward.recipeId}", but that recipe is town-exclusive (sold only via a town's crafting.uniqueRecipeIds) and should never appear in a droppable reward table.`,
        });
        return;
      }

      checks.push({
        id,
        label: source.label,
        status: 'pass',
        message: `${source.label} -> recipeId "${reward.recipeId}" resolves and is player-obtainable.`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every recipe reward resolves to a real, player-obtainable recipe.'
        : `${failures} recipe reward(s) don't resolve or reference a town-exclusive recipe.`,
  };
}
