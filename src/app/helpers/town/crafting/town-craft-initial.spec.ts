import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById } from '@helpers/content/content';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import {
  setGameState,
  updateGamestate,
  worldTownsState,
} from '@helpers/state-game';
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
    setAllContentById(
      new Map(
        [
          ensureItem({ id: oreId }),
          ensureItem({ id: gemId }),
          ensureEquipment({ id: ringId }),
          recipe,
          ringRecipe,
          town,
        ].map((entry) => [entry.id, entry as never]),
      ),
    );

    const state = defaultGameState();
    state.world.towns[townId] = {
      lastProcessedTick: {},
      stock: [],
      workers: {},
      reputation: 0,
      hiddenGold: 0,
      materials: { [oreId]: 30 },
      tradeskills: { [tradeskillId]: { level: 1 } },
      craftQueue: [],
      commissionSlots: [],
      specialtyPriority: [],
    } as never;
    setGameState(state);
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
