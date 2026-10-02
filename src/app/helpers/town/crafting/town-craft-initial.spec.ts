import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById } from '@helpers/content/content';
import { ensureItem } from '@helpers/content/ensure-item';
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

// Real state + eligibility helpers: each pick must see the previous pick's deductions through the draft.
describe('initial town crafts (unmocked)', () => {
  let town: TownContent;

  beforeEach(() => {
    town = ensureTown({
      id: townId,
      crafting: {
        maxQueueSize: [{ tier: 0, value: 12 }],
      } as TownContent['crafting'],
    });
    const recipe = ensureRecipe({
      id: 'recipe-gem' as RecipeId,
      tradeskillId,
      requirements: [{ itemId: oreId, quantity: 20 }],
      result: { itemId: gemId, quantity: 1 },
    });
    setAllContentById(
      new Map(
        [
          ensureItem({ id: oreId }),
          ensureItem({ id: gemId }),
          recipe,
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

  it('completes only what the materials cover, granting the result', async () => {
    await updateGamestate((state) => {
      townCompleteInitialCrafts(state, town, 4);
      return state;
    });

    expect(worldTownsState()[townId].materials).toEqual({
      [oreId]: 10,
      [gemId]: 1,
    });
    expect(worldTownsState()[townId].craftQueue).toEqual([]);
  });
});
