import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(() => true),
}));
vi.mock('@helpers/task/task-progress');

import { WORKER_CRAFT_STAMINA_PER_TRADESKILL_LEVEL } from '@helpers/config';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { defaultTradeskillBuilding } from '@helpers/defaults';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import {
  applyMaterialDelta,
  getMaterialQuantity,
} from '@helpers/item/materials';
import { rngSucceedsChance } from '@helpers/rng';
import {
  tradeskillsState,
  updateGamestate,
  workersState,
} from '@helpers/state-game';
import { taskRecordCraft } from '@helpers/task/task-progress';
import {
  isRecipeWorkerCraftable,
  workerCraftAssignmentIsValid,
  workerCraftingProcessTick,
  workerCraftOrphanedMaterials,
  workerStartCrafting,
  workerStopCrafting,
} from '@helpers/worker/worker-crafting';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  CollectibleId,
  EquipmentId,
  GameState,
  GameStateWorkers,
  ItemId,
  RecipeContent,
  RecipeId,
  TradeskillId,
  WorkerContent,
  WorkerId,
  WorkerState,
  WorkerStatusCrafting,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const smithingId = 'blacksmithing' as TradeskillId;
const recipeId = 'copper-ingot-recipe' as RecipeId;
const otherRecipeId = 'tin-ingot-recipe' as RecipeId;
const workerId = 'weaver-nell' as WorkerId;
const oreId = 'ore' as ItemId;
const ingotId = 'ingot' as ItemId;
const tinId = 'tin' as ItemId;
const daggerId = 'dagger' as EquipmentId;
const toolId = 'tool' as CollectibleId;

function recipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return ensureRecipe({
    id: recipeId,
    name: 'Copper Ingot',
    tradeskillId: smithingId,
    result: { itemId: ingotId, quantity: 1 },
    requirements: [{ itemId: oreId, quantity: 2 }],
    minTradeskillLevel: 1,
    maxTradeskillLevel: 4,
    tradeskillXP: 5,
    craftTime: 4,
    ...overrides,
  });
}

function worker(overrides: Partial<WorkerContent> = {}): WorkerContent {
  return ensureWorker({
    id: workerId,
    name: 'Weaver Nell',
    baseStats: { capacity: 1, gatherSpeed: 1, craftSpeed: 2, stamina: 100 },
    statsPerLevel: { capacity: 0, gatherSpeed: 0, craftSpeed: 0, stamina: 0 },
    ...overrides,
  });
}

function seed(
  recipeOverrides: Partial<RecipeContent> = {},
  workerOverrides: Partial<WorkerContent> = {},
): void {
  seedContent([
    ensureTradeskill({ id: smithingId, name: 'Blacksmithing' }),
    ensureItem({ id: oreId, name: 'Ore' }),
    ensureItem({ id: ingotId, name: 'Copper Ingot' }),
    ensureItem({ id: tinId, name: 'Tin' }),
    ensureEquipment({ id: daggerId, name: 'Dagger' }),
    ensureCollectible({ id: toolId, name: 'Tool' }),
    recipe(recipeOverrides),
    recipe({
      id: otherRecipeId,
      name: 'Tin Ingot',
      requirements: [{ itemId: tinId, quantity: 1 }],
    }),
    worker(workerOverrides),
  ]);
}

function crafting(
  overrides: Partial<WorkerStatusCrafting> = {},
): WorkerStatusCrafting {
  return {
    kind: 'Crafting',
    recipeId,
    ticksIntoCraft: 0,
    materialsHeld: false,
    ...overrides,
  };
}

function seedState(
  workerState: Partial<WorkerState> = {},
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.tradeskills[smithingId] = defaultTradeskillBuilding();
    state.workers[workerId] = {
      ...defaultWorkerState(),
      status: crafting(),
      assignment: { recipeId },
      ...workerState,
    };
    edit?.(state);
  });
}

function giveOre(quantity: number): void {
  inTick(() =>
    updateGamestate((state) => {
      applyMaterialDelta(state, oreId, quantity);
      return state;
    }),
  );
}

const current = (): WorkerState => workersState()[workerId];
const tick = () => inTick(() => workerCraftingProcessTick(workerId));
const ore = () => getMaterialQuantity(oreId);
const ingots = () => getMaterialQuantity(ingotId);

beforeEach(() => {
  vi.clearAllMocks();
  seed();
  seedState();
});

describe('isRecipeWorkerCraftable', () => {
  it('allows a craftable recipe with an item result', () => {
    expect(isRecipeWorkerCraftable(recipe())).toBe(true);
  });

  it('rejects equipment or collectible results and equipment ingredients', () => {
    expect(
      isRecipeWorkerCraftable(recipe({ result: { equipmentId: daggerId } })),
    ).toBe(false);
    expect(
      isRecipeWorkerCraftable(recipe({ result: { collectibleId: toolId } })),
    ).toBe(false);
    expect(
      isRecipeWorkerCraftable(
        recipe({ requirements: [{ equipmentId: daggerId }] }),
      ),
    ).toBe(false);
  });

  it('needs the building level and any collectible gate', () => {
    expect(isRecipeWorkerCraftable(recipe({ minTradeskillLevel: 2 }))).toBe(
      false,
    );

    const gated = recipe({
      requirements: [{ itemId: oreId, quantity: 1 }, { collectibleId: toolId }],
    });
    expect(isRecipeWorkerCraftable(gated)).toBe(false);

    seedState({}, (state) => applyCollectibleGrant(state, toolId, 1));
    expect(isRecipeWorkerCraftable(gated)).toBe(true);
  });
});

describe('workerCraftAssignmentIsValid', () => {
  it('needs stamina for the recipe and a positive craft speed', () => {
    const cost = 3 * WORKER_CRAFT_STAMINA_PER_TRADESKILL_LEVEL;
    seedState({}, (state) => {
      state.tradeskills[smithingId] = {
        ...defaultTradeskillBuilding(),
        level: 3,
      };
    });

    const withStats = (craftSpeed: number, stamina: number) => {
      seed(
        { minTradeskillLevel: 3 },
        { baseStats: { capacity: 1, gatherSpeed: 1, craftSpeed, stamina } },
      );
      return workerCraftAssignmentIsValid(workerId, 1, { recipeId });
    };

    expect(withStats(1, cost)).toBe(true);
    expect(withStats(1, cost - 1)).toBe(false);
    expect(withStats(0, cost)).toBe(false);
  });
});

describe('workerCraftingProcessTick', () => {
  it('waits without materials, then takes one unit once they arrive', () => {
    tick();
    expect(current().status).toEqual(crafting());

    giveOre(5);
    tick();
    expect(ore()).toBe(3);
    expect(current().status).toEqual(
      crafting({ materialsHeld: true, ticksIntoCraft: 1 }),
    );
  });

  it('never takes a partial unit', () => {
    giveOre(1);
    tick();

    expect(ore()).toBe(1);
    expect(current().status).toEqual(crafting());
  });

  it('takes exactly the per-unit ticks, back to back', () => {
    giveOre(4);

    tick();
    expect(ingots()).toBe(0);
    tick();
    expect(ingots()).toBe(1);
    expect(ore()).toBe(0);
    expect(current().status).toEqual(crafting({ materialsHeld: true }));

    tick();
    expect(ingots()).toBe(1);
    tick();
    expect(ingots()).toBe(2);
    expect(current().status).toEqual(crafting());
  });

  it('finishes one unit per tick at a single tick per unit, never chaining', () => {
    seed(
      {},
      {
        baseStats: {
          capacity: 1,
          gatherSpeed: 1,
          craftSpeed: 99,
          stamina: 100,
        },
      },
    );
    giveOre(6);

    tick();
    expect(ingots()).toBe(1);
    tick();
    expect(ingots()).toBe(2);
  });

  it('grants worker xp only within the recipe range, never tradeskill xp or tasks', () => {
    giveOre(2);
    tick();
    tick();
    expect(current().xp.current).toBe(1);
    expect(tradeskillsState()[smithingId].xp.current).toBe(0);
    expect(taskRecordCraft).not.toHaveBeenCalled();

    seedState({ level: 5 });
    giveOre(2);
    tick();
    tick();
    expect(ingots()).toBe(1);
    expect(current().xp.current).toBe(0);
  });

  it('uses up the unit even when the result roll whiffs', () => {
    seed({ result: { itemId: ingotId, quantity: 1, chance: 50 } });
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(false);
    giveOre(2);

    tick();
    tick();

    expect(ore()).toBe(0);
    expect(ingots()).toBe(0);
  });

  it('refunds the held unit and drops the assignment once the recipe stops qualifying', () => {
    giveOre(2);
    tick();
    seed({
      requirements: [{ itemId: oreId, quantity: 2 }, { equipmentId: daggerId }],
    });

    tick();

    expect(ore()).toBe(2);
    expect(current()).toMatchObject({
      status: { kind: 'AtDuchy' },
      assignment: null,
    });
  });
});

describe('workerStartCrafting / workerStopCrafting', () => {
  const start = (id: RecipeId) =>
    inTick(() =>
      updateGamestate((state) => {
        workerStartCrafting(state, workerId, id);
        return state;
      }),
    );
  const stop = () =>
    inTick(() =>
      updateGamestate((state) => {
        workerStopCrafting(state, workerId);
        return state;
      }),
    );

  it('keeps progress when re-picking the same recipe', () => {
    giveOre(2);
    tick();

    start(recipeId);

    expect(current().status).toEqual(
      crafting({ materialsHeld: true, ticksIntoCraft: 1 }),
    );
  });

  it('refunds the held unit when switching recipes', () => {
    giveOre(2);
    tick();

    start(otherRecipeId);

    expect(ore()).toBe(2);
    expect(current().status).toEqual(crafting({ recipeId: otherRecipeId }));
  });

  it('refunds only once, then parks at the duchy', () => {
    giveOre(2);
    tick();

    stop();
    stop();

    expect(ore()).toBe(2);
    expect(current().status).toEqual({ kind: 'AtDuchy' });
  });

  it('does not start a worker that is out gathering', () => {
    seedState({
      status: {
        kind: 'TravelingBack',
        path: [],
        ticksIntoStep: 0,
        carriedQuantity: 0,
      },
    });

    start(recipeId);

    expect(current().status.kind).toBe('TravelingBack');
  });
});

describe('workerCraftOrphanedMaterials', () => {
  it('refunds the held units of exactly the crafters that were parked', () => {
    const state = (status: WorkerState['status']): WorkerState => ({
      ...defaultWorkerState(),
      status,
    });
    const parkedId = 'parked' as WorkerId;
    const keptId = 'kept' as WorkerId;
    const emptyId = 'empty' as WorkerId;

    const before: GameStateWorkers = {
      [parkedId]: state(crafting({ materialsHeld: true })),
      [keptId]: state(crafting({ materialsHeld: true })),
      [emptyId]: state(crafting()),
    };
    const after: GameStateWorkers = {
      [parkedId]: state({ kind: 'AtDuchy' }),
      [keptId]: before[keptId],
      [emptyId]: state({ kind: 'AtDuchy' }),
    };

    expect(workerCraftOrphanedMaterials(before, after)).toEqual([
      { itemId: oreId, quantity: 2 },
    ]);
  });
});
