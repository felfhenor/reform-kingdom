import { contentName } from '@helpers/i18n/i18n-content';
import type { CraftRecipeEntry } from '@interfaces';

function recipeSearchNames(entry: CraftRecipeEntry): string[] {
  return [
    contentName(entry.recipe),
    entry.resultContent ? contentName(entry.resultContent) : undefined,
    ...entry.requirementEntries.map((requirement) =>
      requirement.content ? contentName(requirement.content) : undefined,
    ),
  ].filter((name): name is string => !!name);
}

export function filterCraftRecipeEntries(
  entries: CraftRecipeEntry[],
  searchText: string,
): CraftRecipeEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) =>
    recipeSearchNames(entry).some((name) => name.toLowerCase().includes(text)),
  );
}
