import type { CraftRecipeEntry } from '@interfaces';

function recipeSearchNames(entry: CraftRecipeEntry): string[] {
  return [
    entry.recipe.name,
    entry.resultContent?.name,
    ...entry.requirementEntries.map((requirement) => requirement.content?.name),
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
