import { recipeResultQuantity } from '@helpers/crafting/recipe-result';
import type {
  CollectibleId,
  EquipmentId,
  ItemId,
  RecipeContent,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

const recipeWith = (result: RecipeContent['result']) =>
  ({ result }) as RecipeContent;

describe('recipeResultQuantity', () => {
  it('returns the item result quantity', () => {
    expect(
      recipeResultQuantity(
        recipeWith({ itemId: 'lucre' as ItemId, quantity: 100 }),
      ),
    ).toBe(100);
  });

  it('defaults to 1 when an item result omits quantity', () => {
    expect(
      recipeResultQuantity(recipeWith({ itemId: 'lucre' as ItemId })),
    ).toBe(1);
  });

  it('is 1 for equipment and collectible results', () => {
    expect(
      recipeResultQuantity(recipeWith({ equipmentId: 'cloak' as EquipmentId })),
    ).toBe(1);
    expect(
      recipeResultQuantity(
        recipeWith({ collectibleId: 'effigy' as CollectibleId }),
      ),
    ).toBe(1);
  });
});
