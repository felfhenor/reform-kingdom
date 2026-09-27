import { ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { filterCraftRecipeEntries } from '@helpers/crafting/recipe-filter.ui';
import type { CraftRecipeEntry, CraftRequirementEntry } from '@interfaces';
import { describe, expect, it } from 'vitest';

function requirement(name: string): CraftRequirementEntry {
  return {
    kind: 'item',
    content: ensureItem({ name }),
    spritesheet: 'item',
    quantity: 1,
    owned: 0,
  };
}

function entry(
  name: string,
  materials: string[],
  resultName?: string,
): CraftRecipeEntry {
  return {
    recipe: ensureRecipe({ name }),
    resultContent: resultName ? ensureItem({ name: resultName }) : undefined,
    requirementEntries: materials.map(requirement),
  } as CraftRecipeEntry;
}

const whip = entry('Weapon: Elvenwood Whip', ['Elvenwood Plank', 'Hide Strip']);
const cloak = entry('Equipment: Bone-Hewn Cloak', ['Bone Shard'], 'Cloak');
const entries = [whip, cloak];

describe('filterCraftRecipeEntries', () => {
  it('returns every entry for empty or whitespace-only search', () => {
    expect(filterCraftRecipeEntries(entries, '')).toBe(entries);
    expect(filterCraftRecipeEntries(entries, '   ')).toBe(entries);
  });

  it('matches the recipe name, ignoring case', () => {
    expect(filterCraftRecipeEntries(entries, 'BONE-HEWN')).toEqual([cloak]);
  });

  it('matches a material name', () => {
    expect(filterCraftRecipeEntries(entries, 'hide strip')).toEqual([whip]);
    expect(filterCraftRecipeEntries(entries, 'shard')).toEqual([cloak]);
  });

  it('matches the crafted item name when it differs from the recipe name', () => {
    expect(filterCraftRecipeEntries(entries, 'cloak')).toEqual([cloak]);
  });

  it('keeps every recipe that shares a matching material', () => {
    expect(filterCraftRecipeEntries(entries, 'elvenwood')).toEqual([whip]);
    expect(filterCraftRecipeEntries([whip, whip], 'plank')).toHaveLength(2);
  });

  it('returns nothing when no name matches', () => {
    expect(filterCraftRecipeEntries(entries, 'dragon')).toEqual([]);
  });

  it('ignores requirements without resolved content', () => {
    const unresolved = {
      ...whip,
      requirementEntries: [{ ...requirement('x'), content: undefined }],
    } as CraftRecipeEntry;

    expect(filterCraftRecipeEntries([unresolved], 'plank')).toEqual([]);
  });
});
