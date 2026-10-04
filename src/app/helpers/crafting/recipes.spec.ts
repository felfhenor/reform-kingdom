import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import {
  applyRecipeDiscovery,
  isRecipeCraftable,
  isRecipeDiscovered,
  isRecipeDropGated,
  isRecipeTownUnique,
  pruneInvalidDiscoveredRecipes,
  recipeCanUnlockWithTokens,
  recipeDiscover,
  recipeResultContent,
  recipeResultOwnedQuantity,
  recipeResultSpritesheet,
  recipeStylizedName,
  recipeUndiscover,
} from '@helpers/crafting/recipes';
import { defaultEquipment, defaultGameState } from '@helpers/defaults';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import { discoveredRecipesState } from '@helpers/state-game';
import type {
  CaravanTraderId,
  CollectibleId,
  EncounterId,
  EquipmentId,
  GameState,
  IsContentItem,
  ItemId,
  RecipeId,
  TownId,
  TradeskillId,
} from '@interfaces';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const ingotId = 'copper-ingot' as ItemId;
const scripId = 'trader-scrip' as ItemId;
const cloakId = 'bone-hewn-cloak' as EquipmentId;
const effigyId = 'minor-effigy' as CollectibleId;
const tailoringId = 'tailoring' as TradeskillId;

const ingot = ensureItem({ id: ingotId, name: 'Copper Ingot' });
const cloak = ensureEquipment({ id: cloakId, name: 'Bone-Hewn Cloak' });
const effigy = ensureCollectible({ id: effigyId, name: 'Minor Effigy' });

const itemRecipe = ensureRecipe({
  id: 'material-copper-ingot' as RecipeId,
  name: 'Material: Copper Ingot',
  result: { itemId: ingotId, quantity: 1 },
});
// Gated behind an encounter drop.
const equipmentRecipe = ensureRecipe({
  id: 'equipment-cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  tradeskillId: tailoringId,
  result: { equipmentId: cloakId },
  tokenUnlockCost: 3,
});
// Gated behind a caravan trader sale.
const collectibleRecipe = ensureRecipe({
  id: 'collectible-effigy' as RecipeId,
  name: 'Collectible: Minor Effigy',
  result: { collectibleId: effigyId },
});

const baseContent: IsContentItem[] = [
  ingot,
  cloak,
  effigy,
  ensureItem({ id: scripId, name: 'Trader Scrip' }),
  ensureEquipment({ id: 'other' as EquipmentId, name: 'Other' }),
  ensureTradeskill({ id: tailoringId, name: 'Tailoring' }),
  itemRecipe,
  equipmentRecipe,
  collectibleRecipe,
  ensureEncounter({
    id: 'forest-ruins' as EncounterId,
    name: 'Forest Ruins',
    completionRewards: [
      ensureDroppedReward({ recipeId: equipmentRecipe.id, chance: 0.25 }),
    ],
  }),
  ensureCaravanTrader({
    id: 'alekia' as CaravanTraderId,
    name: 'Alekia Figaro',
    trades: [
      { type: 'sell', value: 25000, recipeId: collectibleRecipe.id, weight: 1 },
    ],
  }),
];

function seedTownUnique(recipeId: RecipeId): void {
  seedContent([
    ...baseContent,
    ensureTown({
      id: 'larsia' as TownId,
      name: 'Larsia',
      crafting: { uniqueRecipeIds: [recipeId] },
    }),
  ]);
}

function seedDiscovered(...recipeIds: RecipeId[]): void {
  seedGamestate((state) =>
    recipeIds.forEach(
      (id) => (state.discoveredRecipes[id] = { foundAt: 1000 }),
    ),
  );
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(5000);
  seedContent(baseContent);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isRecipeDiscovered', () => {
  it('reads the live slice, or an explicit state when given one', () => {
    seedDiscovered(equipmentRecipe.id);
    const explicit = defaultGameState();

    expect(isRecipeDiscovered(equipmentRecipe.id)).toBe(true);
    expect(isRecipeDiscovered(itemRecipe.id)).toBe(false);
    expect(isRecipeDiscovered(equipmentRecipe.id, explicit)).toBe(false);
  });
});

describe('isRecipeDropGated', () => {
  it('is true for a recipe dropped by an encounter or sold by a caravan trader', () => {
    expect(isRecipeDropGated(equipmentRecipe.id)).toBe(true);
    expect(isRecipeDropGated(collectibleRecipe.id)).toBe(true);
  });

  it('is false for a recipe with no drop source', () => {
    expect(isRecipeDropGated(itemRecipe.id)).toBe(false);
  });
});

describe('isRecipeCraftable', () => {
  it('is true for an ungated recipe, and for a gated one only once discovered', () => {
    seedDiscovered();
    expect(isRecipeCraftable(itemRecipe.id)).toBe(true);
    expect(isRecipeCraftable(equipmentRecipe.id)).toBe(false);

    seedDiscovered(equipmentRecipe.id);
    expect(isRecipeCraftable(equipmentRecipe.id)).toBe(true);
  });

  it("is false for a town's unique recipe, even if already discovered", () => {
    seedTownUnique(equipmentRecipe.id);
    seedDiscovered(equipmentRecipe.id);

    expect(isRecipeTownUnique(equipmentRecipe.id)).toBe(true);
    expect(isRecipeTownUnique(itemRecipe.id)).toBe(false);
    expect(isRecipeCraftable(equipmentRecipe.id)).toBe(false);
  });
});

describe('recipe discovery', () => {
  it('stamps a new discovery now and keeps the original on repeat finds', () => {
    const state = defaultGameState();
    state.discoveredRecipes[itemRecipe.id] = { foundAt: 1000 };

    applyRecipeDiscovery(state, itemRecipe.id);
    applyRecipeDiscovery(state, equipmentRecipe.id);

    expect(state.discoveredRecipes).toEqual({
      [itemRecipe.id]: { foundAt: 1000 },
      [equipmentRecipe.id]: { foundAt: 5000 },
    });
  });

  it('discovers and undiscovers through the committed state', () => {
    seedDiscovered();

    inTick(() => recipeDiscover(equipmentRecipe.id));
    expect(discoveredRecipesState()[equipmentRecipe.id]).toEqual({
      foundAt: 5000,
    });

    inTick(() => recipeUndiscover(equipmentRecipe.id));
    expect(discoveredRecipesState()).toEqual({});
  });
});

describe('pruneInvalidDiscoveredRecipes', () => {
  it('drops only the entries that no longer resolve to content', () => {
    expect(
      pruneInvalidDiscoveredRecipes({
        [itemRecipe.id]: { foundAt: 1000 },
        ['stale' as RecipeId]: { foundAt: 1000 },
      }),
    ).toEqual({ [itemRecipe.id]: { foundAt: 1000 } });
  });
});

describe('recipe results', () => {
  it.each([
    [itemRecipe, 'item', ingot],
    [equipmentRecipe, 'equipment', cloak],
    [collectibleRecipe, 'collectible', effigy],
  ])(
    'resolves the spritesheet and content for %#',
    (recipe, sheet, content) => {
      expect(recipeResultSpritesheet(recipe)).toBe(sheet);
      expect(recipeResultContent(recipe)).toEqual(content);
    },
  );

  it('counts owned materials and collectibles', () => {
    seedGamestate((state) => {
      applyMaterialDelta(state, ingotId, 12);
      applyCollectibleGrant(state, effigyId, 3);
    });

    expect(recipeResultOwnedQuantity(itemRecipe)).toBe(12);
    expect(recipeResultOwnedQuantity(collectibleRecipe)).toBe(3);
  });

  it('sums armory-stored and equipped copies of equipment', () => {
    seedGamestate((state) => {
      state.armory = [
        buildEquipmentItem(cloakId),
        buildEquipmentItem(cloakId),
        buildEquipmentItem('other' as EquipmentId),
      ];
      state.world.party = [
        buildCharacter({
          equipment: {
            ...defaultEquipment(),
            Armor: buildEquipmentItem(cloakId),
          },
        }),
        buildCharacter(),
      ];
    });

    expect(recipeResultOwnedQuantity(equipmentRecipe)).toBe(3);
  });

  it('prefixes the stylized name with the tradeskill', () => {
    expect(recipeStylizedName(equipmentRecipe)).toBe(
      'Tailoring Recipe: Bone-Hewn Cloak',
    );
    expect(recipeStylizedName(itemRecipe)).toBe(itemRecipe.name);
    expect(
      recipeStylizedName({ ...equipmentRecipe, name: 'Unprefixed Cloak' }),
    ).toBe('Tailoring Recipe: Unprefixed Cloak');
  });
});

describe('recipeCanUnlockWithTokens', () => {
  function withScrip(quantity: number): (state: GameState) => void {
    return (state) => applyMaterialDelta(state, scripId, quantity);
  }

  it('is true for a gated, undiscovered recipe the player can afford', () => {
    seedGamestate(withScrip(equipmentRecipe.tokenUnlockCost));

    expect(recipeCanUnlockWithTokens(equipmentRecipe.id)).toBe(true);
  });

  it('is false when the player cannot afford it', () => {
    seedGamestate(withScrip(equipmentRecipe.tokenUnlockCost - 1));

    expect(recipeCanUnlockWithTokens(equipmentRecipe.id)).toBe(false);
  });

  it('is false for an already-discovered or ungated recipe, even when affordable', () => {
    seedGamestate((state) => {
      withScrip(100)(state);
      state.discoveredRecipes[collectibleRecipe.id] = { foundAt: 1000 };
    });

    expect(recipeCanUnlockWithTokens(collectibleRecipe.id)).toBe(false);
    expect(recipeCanUnlockWithTokens(itemRecipe.id)).toBe(false);
  });

  it('validates against an explicit state instead of the live slices', () => {
    seedGamestate(withScrip(equipmentRecipe.tokenUnlockCost));
    const spent = defaultGameState();
    const unlocked = defaultGameState();
    withScrip(100)(unlocked);
    unlocked.discoveredRecipes[equipmentRecipe.id] = { foundAt: 1000 };

    expect(recipeCanUnlockWithTokens(equipmentRecipe.id, spent)).toBe(false);
    expect(recipeCanUnlockWithTokens(equipmentRecipe.id, unlocked)).toBe(false);
  });
});
