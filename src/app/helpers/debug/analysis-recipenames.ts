/**
 * Validates that every recipe's `name` is prefixed according to what its
 * `result` produces ("Weapon:"/"Equipment:"/"Material:"/"Collectible:").
 * Ported from `scripts/validate-recipenames.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CollectibleContent,
  EquipmentContent,
  EquipmentItemType,
  ItemContent,
  RecipeContent,
  RecipeResult,
} from '@interfaces';

// Mirrors `EquipmentTypeToSlot` in src/app/interfaces/equipment.ts - types
// that can occupy the 'Weapon' (main hand) slot.
const MAIN_HAND_EQUIPMENT_TYPES = new Set<EquipmentItemType>([
  'Bow',
  'Dagger',
  'Mace',
  'Spear',
  'Staff',
  'Sword',
  'Whip',
]);

const PREFIXES = {
  weapon: 'Weapon: ',
  equipment: 'Equipment: ',
  material: 'Material: ',
  collectible: 'Collectible: ',
};

function expectedPrefix(
  result: RecipeResult,
  equipmentTypeById: Map<string, EquipmentItemType>,
  itemIds: Set<string>,
  collectibleIds: Set<string>,
): string | undefined {
  if ('equipmentId' in result) {
    const type = equipmentTypeById.get(result.equipmentId);
    if (!type) return undefined;
    return MAIN_HAND_EQUIPMENT_TYPES.has(type) ? PREFIXES.weapon : PREFIXES.equipment;
  }

  if ('itemId' in result && itemIds.has(result.itemId)) return PREFIXES.material;
  if ('collectibleId' in result && collectibleIds.has(result.collectibleId)) {
    return PREFIXES.collectible;
  }

  return undefined;
}

export function runRecipeNamesAnalysis(): AnalysisRunResult {
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const equipmentTypeById = new Map(
    getEntriesByType<EquipmentContent>('equipment').map((e) => [e.id, e.type]),
  );
  const itemIds = new Set(getEntriesByType<ItemContent>('item').map((i) => i.id));
  const collectibleIds = new Set(
    getEntriesByType<CollectibleContent>('collectible').map((c) => c.id),
  );

  const checks: AnalysisCheck[] = recipes.map((recipe) => {
    const prefix = expectedPrefix(recipe.result, equipmentTypeById, itemIds, collectibleIds);

    if (!prefix) {
      return {
        id: `recipe-name:${recipe.id}`,
        label: recipe.name,
        status: 'fail',
        message: `Recipe "${recipe.name}" (${recipe.id}) has a result that doesn't resolve to a known equipment, item, or collectible.`,
      };
    }

    if (!recipe.name.startsWith(prefix)) {
      return {
        id: `recipe-name:${recipe.id}`,
        label: recipe.name,
        status: 'fail',
        message: `Recipe "${recipe.name}" (${recipe.id}) should start with "${prefix}".`,
      };
    }

    return {
      id: `recipe-name:${recipe.id}`,
      label: recipe.name,
      status: 'pass',
      message: `"${recipe.name}" has the correct prefix.`,
    };
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every recipe name matches its result type.'
        : `${failures} recipe name(s) don't match their result type.`,
  };
}
