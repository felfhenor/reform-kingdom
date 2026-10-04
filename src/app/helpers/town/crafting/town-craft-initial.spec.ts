import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import {
  townCompleteInitialCrafts,
  townQueueInitialCrafts,
} from '@helpers/town/crafting/town-craft-queue';
import type {
  EquipmentId,
  ItemId,
  RecipeId,
  TownContent,
  TownId,
  TradeskillId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const tradeskillId = 'jewelcrafting' as TradeskillId;
const oreId = 'ore' as ItemId;
const gemId = 'gem' as ItemId;
const ringId = 'ring' as EquipmentId;

// Real state + eligibility helpers: each pick must see the previous pick's deductions through the draft.
describe('initial town crafts (unmocked)', () => {
  let town: TownContent;

  beforeEach(() => {
    town = ensureTown({
      id: townId,
      crafting: {
        maxQueueSize: [{ tier: 0, value: 12 }],
      },
      traders: {
        sellItemCount: [{ tier: 0, value: 10 }],
      },
    });
    const recipe = ensureRecipe({
      id: 'recipe-gem' as RecipeId,
      tradeskillId,
      requirements: [{ itemId: oreId, quantity: 20 }],
      result: { itemId: gemId, quantity: 1 },
    });
    const ringRecipe = ensureRecipe({
      id: 'recipe-ring' as RecipeId,
      tradeskillId,
      requirements: [{ itemId: oreId, quantity: 20 }],
      result: { equipmentId: ringId },
    });
    seedContent([
      ensureItem({ id: oreId }),
      ensureItem({ id: gemId }),
      ensureEquipment({ id: ringId }),
      recipe,
      ringRecipe,
      town,
    ]);
    seedGamestate(
      (state) =>
        (state.world.towns[townId] = buildTownNodeState({
          materials: { [oreId]: 30 },
          tradeskills: { [tradeskillId]: { level: 1 } },
        })),
    );
  });

  it('only queues what the materials cover', async () => {
    await updateGamestate((state) => {
      townQueueInitialCrafts(state, town, 4);
      return state;
    });

    expect(worldTownsState()[townId].craftQueue).toHaveLength(1);
    expect(worldTownsState()[townId].materials[oreId]).toBe(10);
  });

  it('completes only equipment, as far as the materials cover', async () => {
    await updateGamestate((state) => {
      townCompleteInitialCrafts(state, town, 4);
      return state;
    });

    const result = worldTownsState()[townId];
    expect(
      result.stock.map((entry) => entry.equipmentItem.equipmentId),
    ).toEqual([ringId]);
    expect(result.materials).toEqual({ [oreId]: 10 });
    expect(result.craftQueue).toEqual([]);
  });
});
