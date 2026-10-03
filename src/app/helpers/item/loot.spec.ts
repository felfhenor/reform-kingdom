import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngNumberRange: vi.fn(actual.rngNumberRange) };
});

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState, defaultTradeskillBuilding } from '@helpers/defaults';
import {
  applyResolvedDropToState,
  combatItemDropRateBoost,
  isClearProofReward,
  rewardDisplayOrder,
  rollDroppedRewards,
} from '@helpers/item/loot';
import { armoryOverflowCap } from '@helpers/kingdom/armory';
import { rngNumberRange } from '@helpers/rng';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  CollectibleId,
  DroppedItemReward,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
  TownId,
  TradeskillId,
  WorkerId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const goldCoinId = 'gold-coin' as ItemId;
const cloakId = 'cloak' as EquipmentId;
const swampClamId = 'swamp-clam' as CollectibleId;
const cloakRecipeId = 'cloak-recipe' as RecipeId;
const weaverNellId = 'weaver-nell' as WorkerId;
const artificing = 'artificing' as TradeskillId;

const gold = (overrides: Omit<Partial<DroppedItemReward>, 'kind'> = {}) =>
  ensureDroppedReward({
    itemId: goldCoinId,
    min: 3,
    max: 10,
    chance: 100,
    ...overrides,
  });
const guaranteed = {
  equipment: ensureDroppedReward({ equipmentId: cloakId, chance: 100 }),
  collectible: ensureDroppedReward({ collectibleId: swampClamId, chance: 100 }),
  recipe: ensureDroppedReward({ recipeId: cloakRecipeId, chance: 100 }),
  worker: ensureDroppedReward({ workerId: weaverNellId, chance: 100 }),
};

// Every roll lands on the bottom or top of its range.
function forceRolls(edge: 'lowest' | 'highest'): void {
  vi.mocked(rngNumberRange).mockImplementation((min, max) =>
    edge === 'lowest' ? min : max,
  );
}

beforeEach(() => {
  vi.mocked(rngNumberRange).mockRestore();
});

describe('rollDroppedRewards', () => {
  it('drops a guaranteed reward even on the highest roll, and a 0% one never', () => {
    for (const edge of ['lowest', 'highest'] as const) {
      forceRolls(edge);

      expect(
        rollDroppedRewards(
          [
            ...Object.values(guaranteed),
            gold({ chance: 0 }),
            ensureDroppedReward({ equipmentId: cloakId, chance: 0 }),
          ],
          1,
        ),
      ).toEqual([
        { equipmentId: cloakId, kind: 'Equipment' },
        { collectibleId: swampClamId, kind: 'Collectible' },
        { recipeId: cloakRecipeId, kind: 'Recipe' },
        { workerId: weaverNellId, kind: 'Worker' },
      ]);
    }
  });

  it('rolls an item quantity across its whole range, both ends included', () => {
    forceRolls('lowest');
    expect(rollDroppedRewards([gold()], 1)).toEqual([
      { itemId: goldCoinId, quantity: 3, kind: 'Item' },
    ]);

    forceRolls('highest');
    expect(rollDroppedRewards([gold()], 1)).toEqual([
      { itemId: goldCoinId, quantity: 10, kind: 'Item' },
    ]);
  });

  it('shifts the item range up by bonusPerLevel per level', () => {
    forceRolls('lowest');

    expect(rollDroppedRewards([gold({ bonusPerLevel: 1 })], 3)).toEqual([
      { itemId: goldCoinId, quantity: 6, kind: 'Item' },
    ]);
  });

  it('drops nothing for an item that rolls a quantity of 0', () => {
    forceRolls('highest');

    expect(rollDroppedRewards([gold({ min: 0, max: 0 })], 1)).toEqual([]);
  });

  it('only rolls rewards within their level bounds', () => {
    forceRolls('highest');
    const bounded = gold({ minLevel: 5, maxLevel: 10 });

    expect(rollDroppedRewards([bounded], 4)).toEqual([]);
    expect(rollDroppedRewards([bounded], 5)).toHaveLength(1);
    expect(rollDroppedRewards([bounded], 10)).toHaveLength(1);
    expect(rollDroppedRewards([bounded], 11)).toEqual([]);
  });

  it('adds the bonus chance before rolling', () => {
    forceRolls('highest');
    const unlikely = ensureDroppedReward({ equipmentId: cloakId, chance: 0 });

    expect(rollDroppedRewards([unlikely], 5, 99)).toEqual([]);
    expect(rollDroppedRewards([unlikely], 5, 100)).toEqual([
      { equipmentId: cloakId, kind: 'Equipment' },
    ]);
  });

  it('returns nothing for no rewards', () => {
    expect(rollDroppedRewards([], 1)).toEqual([]);
  });

  describe('recipe drops', () => {
    function seedRecipe(townUnique: boolean, tradeskillLevel = 1): GameState {
      seedContent([
        ensureRecipe({
          id: cloakRecipeId,
          tradeskillId: artificing,
          minTradeskillLevel: 5,
        }),
        ensureTown({
          id: 'larsia' as TownId,
          crafting: { uniqueRecipeIds: townUnique ? [cloakRecipeId] : [] },
        }),
      ]);
      return seedGamestate(
        (state) =>
          (state.tradeskills[artificing] = {
            ...defaultTradeskillBuilding(),
            level: tradeskillLevel,
          }),
      );
    }

    it('drop once the player can craft them', () => {
      expect(
        rollDroppedRewards([guaranteed.recipe], 5, 0, seedRecipe(false, 5)),
      ).toHaveLength(1);
      expect(rollDroppedRewards([guaranteed.recipe], 5)).toHaveLength(1);
    });

    it('don’t drop below their tradeskill level, or when only a town crafts them', () => {
      expect(
        rollDroppedRewards([guaranteed.recipe], 5, 0, seedRecipe(false, 4)),
      ).toEqual([]);
      expect(
        rollDroppedRewards([guaranteed.recipe], 5, 0, seedRecipe(true, 5)),
      ).toEqual([]);
    });

    it('still drop when the recipe content is missing', () => {
      seedContent([]);

      expect(rollDroppedRewards([guaranteed.recipe], 5)).toHaveLength(1);
    });
  });
});

describe('combatItemDropRateBoost', () => {
  it('reads the cached global effect sum', () => {
    seedGamestate(
      (state) => (state.globalEffectSums.combatItemDropRateBoost = 9),
    );

    expect(combatItemDropRateBoost()).toBe(9);
  });
});

describe('rewardDisplayOrder', () => {
  it('orders workers, collectibles, equipment, recipes, then items', () => {
    const { worker, collectible, equipment, recipe } = guaranteed;

    expect(
      sortBy(
        [gold(), equipment, collectible, recipe, worker],
        [rewardDisplayOrder],
      ),
    ).toEqual([worker, collectible, equipment, recipe, gold()]);
  });
});

describe('applyResolvedDropToState', () => {
  it('adds an item drop to stock', () => {
    const state = defaultGameState();

    applyResolvedDropToState(state, {
      kind: 'Item',
      itemId: goldCoinId,
      quantity: 5,
    });

    expect(state.materials[goldCoinId]?.quantity).toBe(5);
  });

  it('adds an equipment drop to the armory, keeping its first discovery date', () => {
    const state = defaultGameState();
    state.discoveredEquipment[cloakId] = { foundAt: 1000 };

    applyResolvedDropToState(state, {
      kind: 'Equipment',
      equipmentId: cloakId,
    });

    expect(state.armory).toEqual([
      expect.objectContaining({ equipmentId: cloakId }),
    ]);
    expect(state.discoveredEquipment[cloakId]).toEqual({ foundAt: 1000 });
  });

  it('marks first-found equipment discovered', () => {
    const state = defaultGameState();

    applyResolvedDropToState(state, {
      kind: 'Equipment',
      equipmentId: cloakId,
    });

    expect(state.discoveredEquipment[cloakId]?.foundAt).toEqual(
      expect.any(Number),
    );
  });

  it('lets equipment drops overflow the armory cap up to the overflow allowance', () => {
    const cap = armoryOverflowCap();
    const withArmory = (count: number) => {
      const state = defaultGameState();
      state.armory = Array.from({ length: count }, () =>
        buildEquipmentItem('shield' as EquipmentId),
      );
      applyResolvedDropToState(state, {
        kind: 'Equipment',
        equipmentId: cloakId,
      });
      return state.armory.length;
    };

    expect(withArmory(cap - 1)).toBe(cap);
    expect(withArmory(cap)).toBe(cap);
  });

  it('adds a collectible drop to an existing stack, keeping its discovery date', () => {
    const state = defaultGameState();
    state.collectibles[swampClamId] = { quantity: 2, foundAt: 1000 };

    applyResolvedDropToState(state, {
      kind: 'Collectible',
      collectibleId: swampClamId,
    });

    expect(state.collectibles[swampClamId]).toEqual({
      quantity: 3,
      foundAt: 1000,
    });
  });

  it('discovers a recipe drop', () => {
    const state = defaultGameState();

    applyResolvedDropToState(state, {
      kind: 'Recipe',
      recipeId: cloakRecipeId,
    });

    expect(state.discoveredRecipes[cloakRecipeId]?.foundAt).toEqual(
      expect.any(Number),
    );
  });

  it('rescues a worker drop once, leaving an already-rescued worker’s progress alone', () => {
    const state = defaultGameState();

    applyResolvedDropToState(state, { kind: 'Worker', workerId: weaverNellId });
    expect(state.discoveredWorkers[weaverNellId]?.foundAt).toEqual(
      expect.any(Number),
    );
    expect(state.workers[weaverNellId]).toEqual(defaultWorkerState());

    const progressed = { ...defaultWorkerState(), level: 7 };
    state.workers[weaverNellId] = progressed;
    applyResolvedDropToState(state, { kind: 'Worker', workerId: weaverNellId });
    expect(state.workers[weaverNellId]).toBe(progressed);
  });
});

describe('isClearProofReward', () => {
  it('accepts guaranteed collectibles and workers only', () => {
    expect(isClearProofReward(guaranteed.collectible)).toBe(true);
    expect(isClearProofReward(guaranteed.worker)).toBe(true);
    expect(
      isClearProofReward(
        ensureDroppedReward({ collectibleId: swampClamId, chance: 50 }),
      ),
    ).toBe(false);
    expect(isClearProofReward(guaranteed.equipment)).toBe(false);
    expect(isClearProofReward(gold())).toBe(false);
  });
});
