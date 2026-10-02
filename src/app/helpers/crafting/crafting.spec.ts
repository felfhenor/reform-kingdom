import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_CRAFTABLE_CAP } from '@helpers/config';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import {
  craftQueueOrphanedEquipment,
  craftQueueTicksRemaining,
  getCraftableRecipeEntries,
  pruneInvalidCraftQueues,
} from '@helpers/crafting/crafting';
import { defaultTradeskillBuilding } from '@helpers/defaults';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CollectibleId,
  CraftQueueEntry,
  EquipmentId,
  GameState,
  GameStateTradeskills,
  IsContentItem,
  ItemId,
  RecipeContent,
  RecipeId,
  TradeskillBuildingState,
  TradeskillId,
} from '@interfaces';
import { buildCraftQueueEntry, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const BLACKSMITHING_ID = 'blacksmithing' as TradeskillId;
const oreId = 'ore' as ItemId;
const hammerId = 'hammer' as EquipmentId;
const daggerId = 'dagger' as EquipmentId;
const toolId = 'tool' as CollectibleId;

const baseContent: IsContentItem[] = [
  ensureTradeskill({ id: BLACKSMITHING_ID, name: 'Blacksmithing' }),
  ensureItem({ id: oreId, name: 'Ore' }),
  ensureEquipment({ id: hammerId, name: 'Hammer' }),
  ensureEquipment({ id: daggerId, name: 'Dagger' }),
  ensureCollectible({ id: toolId, name: 'Tool' }),
];

function recipe(
  id: string,
  overrides: Partial<RecipeContent> = {},
): RecipeContent {
  return ensureRecipe({
    id: id as RecipeId,
    name: id,
    tradeskillId: BLACKSMITHING_ID,
    result: { itemId: oreId, quantity: 1 },
    ...overrides,
  });
}

function seedBlacksmithing(
  level: number,
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.tradeskills[BLACKSMITHING_ID] = {
      ...defaultTradeskillBuilding(),
      level,
    };
    edit?.(state);
  });
}

function craftableIds(): string[] {
  return getCraftableRecipeEntries('Blacksmithing').map(
    (entry) => entry.recipe.id,
  );
}

function building(queue: CraftQueueEntry[]): TradeskillBuildingState {
  return { ...defaultTradeskillBuilding(), queue };
}

beforeEach(() => seedContent(baseContent));

describe('getCraftableRecipeEntries', () => {
  it('only includes recipes for this tradeskill that the building has reached', () => {
    seedContent([
      ...baseContent,
      recipe('low', { minTradeskillLevel: 1 }),
      recipe('high', { minTradeskillLevel: 3 }),
      recipe('other-tradeskill', { tradeskillId: 'woodworking' as never }),
    ]);
    seedBlacksmithing(2);

    expect(craftableIds()).toEqual(['low']);
  });

  it('excludes a drop-gated recipe until it is discovered', () => {
    const gated = recipe('gated');
    seedContent([
      ...baseContent,
      gated,
      recipe('open'),
      ensureEncounter({
        id: 'ruins' as never,
        completionRewards: [ensureDroppedReward({ recipeId: gated.id })],
      }),
    ]);
    seedBlacksmithing(5);
    expect(craftableIds()).toEqual(['open']);

    seedBlacksmithing(5, (state) => {
      state.discoveredRecipes[gated.id] = { foundAt: 1 };
    });
    expect(craftableIds()).toEqual(['gated', 'open']);
  });

  it('shows the real craftable count but caps the queueable batch', () => {
    seedContent([
      ...baseContent,
      recipe('ingot', { requirements: [{ itemId: oreId, quantity: 1 }] }),
    ]);
    seedBlacksmithing(1, (state) =>
      applyMaterialDelta(state, oreId, MAX_CRAFTABLE_CAP + 50),
    );

    const [entry] = getCraftableRecipeEntries('Blacksmithing');

    expect(entry.maxCraftable).toBe(MAX_CRAFTABLE_CAP + 50);
    expect(entry.maxQueueable).toBe(MAX_CRAFTABLE_CAP);
  });

  it("sorts by the recipe's own level descending, then result rarity, then name - never by affordability", () => {
    const result = (id: string, rarity: 'Common' | 'Rare') =>
      ensureEquipment({ id: id as EquipmentId, name: id, rarity });
    seedContent([
      ...baseContent,
      result('rare-gear', 'Rare'),
      result('common-gear', 'Common'),
      recipe('low', { minTradeskillLevel: 1 }),
      recipe('unaffordable', {
        minTradeskillLevel: 11,
        requirements: [{ itemId: oreId, quantity: 1 }],
      }),
      recipe('a-rare', {
        minTradeskillLevel: 4,
        result: { equipmentId: 'rare-gear' as EquipmentId },
      }),
      recipe('b-common', {
        minTradeskillLevel: 4,
        result: { equipmentId: 'common-gear' as EquipmentId },
      }),
      recipe('a-common', {
        minTradeskillLevel: 4,
        result: { equipmentId: 'common-gear' as EquipmentId },
      }),
    ]);
    seedBlacksmithing(20);

    expect(craftableIds()).toEqual([
      'unaffordable',
      'a-common',
      'b-common',
      'a-rare',
      'low',
    ]);
  });

  it('lists requirements collectible, then equipment, then item, with what the player owns', () => {
    seedContent([
      ...baseContent,
      recipe('forge', {
        requirements: [
          { itemId: oreId, quantity: 3 },
          { equipmentId: hammerId },
          { collectibleId: toolId },
        ],
      }),
    ]);
    seedBlacksmithing(5, (state) => {
      applyMaterialDelta(state, oreId, 7);
      state.armory = [buildEquipmentItem(hammerId)];
    });

    const [entry] = getCraftableRecipeEntries('Blacksmithing');

    expect(
      entry.requirementEntries.map(({ kind, quantity, owned }) => ({
        kind,
        quantity,
        owned,
      })),
    ).toEqual([
      { kind: 'collectible', quantity: 1, owned: 0 },
      { kind: 'equipment', quantity: 1, owned: 1 },
      { kind: 'item', quantity: 3, owned: 7 },
    ]);
  });
});

describe('craftQueueTicksRemaining', () => {
  it('sums the active unit remainder plus every not-yet-started unit', () => {
    seedContent([
      ...baseContent,
      recipe('ore-recipe', { craftTime: 10 }),
      recipe('ring-recipe', { craftTime: 20 }),
    ]);
    seedGamestate((state) => {
      state.tradeskills[BLACKSMITHING_ID] = building([
        buildCraftQueueEntry({
          recipeId: 'ore-recipe' as RecipeId,
          quantityTotal: 5,
          quantityCompleted: 2,
          ticksIntoCraft: 4,
        }),
        buildCraftQueueEntry({
          recipeId: 'ring-recipe' as RecipeId,
          quantityTotal: 2,
        }),
        buildCraftQueueEntry({ recipeId: 'gone' as RecipeId }),
      ]);
    });

    // Ore: (10 - 4) + (5 - 2 - 1) * 10 = 26. Ring: 2 * 20 = 40.
    expect(craftQueueTicksRemaining('Blacksmithing')).toBe(66);
  });
});

describe('pruneInvalidCraftQueues', () => {
  it('drops entries whose recipe is gone and backfills reservedEquipment on legacy entries', () => {
    const kept = recipe('kept');
    seedContent([...baseContent, kept]);
    const legacy = {
      ...buildCraftQueueEntry({ recipeId: kept.id }),
      reservedEquipment: undefined,
    } as unknown as CraftQueueEntry;

    const result = pruneInvalidCraftQueues({
      [BLACKSMITHING_ID]: building([
        legacy,
        buildCraftQueueEntry({ recipeId: 'gone' as RecipeId }),
      ]),
    } as GameStateTradeskills);

    expect(result[BLACKSMITHING_ID].queue).toEqual([
      { ...legacy, reservedEquipment: [] },
    ]);
  });

  it('drops reserved gear whose equipment no longer exists', () => {
    const kept = recipe('kept', { requirements: [{ equipmentId: daggerId }] });
    seedContent([...baseContent, kept]);
    const dagger = buildEquipmentItem(daggerId);

    const result = pruneInvalidCraftQueues({
      [BLACKSMITHING_ID]: building([
        buildCraftQueueEntry({
          recipeId: kept.id,
          reservedEquipment: [
            dagger,
            buildEquipmentItem('gone' as EquipmentId),
          ],
        }),
      ]),
    } as GameStateTradeskills);

    expect(result[BLACKSMITHING_ID].queue[0].reservedEquipment).toEqual([
      dagger,
    ]);
  });
});

describe('craftQueueOrphanedEquipment', () => {
  it('returns still-valid gear reserved by entries whose recipe no longer exists', () => {
    const kept = recipe('kept');
    seedContent([...baseContent, kept]);
    const orphaned = buildEquipmentItem(daggerId, { infusedItemIds: [oreId] });
    const stillQueued = buildEquipmentItem(hammerId);

    const result = craftQueueOrphanedEquipment({
      [BLACKSMITHING_ID]: building([
        buildCraftQueueEntry({
          recipeId: 'gone' as RecipeId,
          reservedEquipment: [
            orphaned,
            buildEquipmentItem('gone' as EquipmentId),
          ],
        }),
        buildCraftQueueEntry({
          recipeId: kept.id,
          reservedEquipment: [stillQueued],
        }),
      ]),
    } as GameStateTradeskills);

    expect(result).toEqual([orphaned]);
  });
});
