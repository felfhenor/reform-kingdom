import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(() => true),
}));
vi.mock('@helpers/task/task-progress');

import { combatLog } from '@helpers/combat/combat-log';
import { MAX_CRAFTABLE_CAP } from '@helpers/config';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import {
  craftMaxCraftableQuantity,
  craftMaxQueueableQuantity,
  craftProcessTick,
  craftQueueStart,
} from '@helpers/crafting/crafting-queue';
import { tradeskillMaxQueueSize } from '@helpers/crafting/tradeskill';
import { defaultTradeskillBuilding } from '@helpers/defaults';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import { armoryCap } from '@helpers/kingdom/armory';
import { rngSucceedsChance } from '@helpers/rng';
import { gamestate, tradeskillsState } from '@helpers/state-game';
import { taskRecordCraft } from '@helpers/task/task-progress';
import type {
  CollectibleId,
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemId,
  RecipeContent,
  RecipeId,
  TradeskillBuildingState,
  TradeskillId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildCraftQueueEntry, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const BLACKSMITHING_ID = 'blacksmithing' as TradeskillId;
const WOODWORKING_ID = 'woodworking' as TradeskillId;
const recipeId = 'recipe-1' as RecipeId;
const oreId = 'ore' as ItemId;
const ingotId = 'copper-ingot' as ItemId;
const malachiteId = 'malachite' as ItemId;
const daggerId = 'dagger' as EquipmentId;
const swordId = 'sword' as EquipmentId;
const copperDaggerId = 'copper-dagger' as EquipmentId;
const steelDaggerId = 'steel-dagger' as EquipmentId;
const effigyId = 'effigy' as CollectibleId;
const toolId = 'tool' as CollectibleId;

function seedRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  const recipe = ensureRecipe({
    id: recipeId,
    name: 'Material: Copper Ingot',
    tradeskillId: BLACKSMITHING_ID,
    result: { itemId: ingotId, quantity: 1 },
    maxTradeskillLevel: 10,
    tradeskillXP: 1,
    craftTime: 5,
    ...overrides,
  });
  seedContent([
    ensureTradeskill({ id: BLACKSMITHING_ID, name: 'Blacksmithing' }),
    ensureTradeskill({ id: WOODWORKING_ID, name: 'Woodworking' }),
    ensureItem({ id: oreId, name: 'Ore' }),
    ensureItem({ id: ingotId, name: 'Copper Ingot', sprite: 'ingot-sprite' }),
    ensureItem({ id: malachiteId, name: 'Malachite' }),
    ensureEquipment({ id: daggerId, name: 'Dagger' }),
    ensureEquipment({ id: swordId, name: 'Sword' }),
    ensureEquipment({
      id: copperDaggerId,
      name: 'Copper Dagger',
      sprite: 'dagger-sprite',
    }),
    ensureEquipment({ id: steelDaggerId, name: 'Steel Dagger' }),
    ensureCollectible({
      id: effigyId,
      name: 'Effigy',
      sprite: 'effigy-sprite',
    }),
    ensureCollectible({ id: toolId, name: 'Tool' }),
    recipe,
  ]);
  return recipe;
}

function seedBlacksmithing(
  building: Partial<TradeskillBuildingState> = {},
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.tradeskills[BLACKSMITHING_ID] = {
      ...defaultTradeskillBuilding(),
      ...building,
    };
    edit?.(state);
  });
}

function withOre(quantity: number): (state: GameState) => void {
  return (state) => applyMaterialDelta(state, oreId, quantity);
}

function entry(overrides: Partial<CraftQueueEntry> = {}): CraftQueueEntry {
  return buildCraftQueueEntry({ recipeId, ...overrides });
}

function otherRecipeEntries(count: number): CraftQueueEntry[] {
  return Array.from({ length: count }, (_, i) =>
    buildCraftQueueEntry({ recipeId: `other-${i}` as RecipeId }),
  );
}

function fullQueueSize(): number {
  return tradeskillMaxQueueSize(1, 'Blacksmithing');
}

function fullArmory(): EquipmentItem[] {
  return Array.from({ length: armoryCap() }, () => buildEquipmentItem(swordId));
}

function blacksmithing(): TradeskillBuildingState {
  return tradeskillsState()[BLACKSMITHING_ID];
}

function queueStart(quantity: number): boolean {
  return inTick(() => craftQueueStart('Blacksmithing', recipeId, quantity));
}

function processTick(): void {
  inTick(craftProcessTick);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rngSucceedsChance).mockReturnValue(true);
});

describe('craftMaxCraftableQuantity', () => {
  function maxCraftable(
    overrides: Partial<RecipeContent>,
    edit?: (state: GameState) => void,
  ): number {
    const recipe = seedRecipe(overrides);
    seedBlacksmithing({}, edit);
    return craftMaxCraftableQuantity(recipe, 'Blacksmithing');
  }

  it('is uncapped (up to the batch cap) with no requirements', () => {
    expect(maxCraftable({ requirements: [] })).toBe(MAX_CRAFTABLE_CAP);
  });

  it('takes the minimum across every item requirement', () => {
    const quantity = maxCraftable(
      {
        requirements: [
          { itemId: oreId, quantity: 2 },
          { itemId: ingotId, quantity: 1 },
        ],
      },
      (state) => {
        applyMaterialDelta(state, oreId, 10);
        applyMaterialDelta(state, ingotId, 3);
      },
    );

    expect(quantity).toBe(3);
  });

  it('reports the real resource count past the batch cap', () => {
    const ore = (MAX_CRAFTABLE_CAP + 1) * 2;

    expect(
      maxCraftable(
        { requirements: [{ itemId: oreId, quantity: 2 }] },
        withOre(ore),
      ),
    ).toBe(MAX_CRAFTABLE_CAP + 1);
  });

  it('treats a 0-quantity requirement as unlimited rather than uncraftable', () => {
    expect(
      maxCraftable({ requirements: [{ itemId: oreId, quantity: 0 }] }),
    ).toBe(MAX_CRAFTABLE_CAP);
  });

  it('counts equipment requirements from the armory', () => {
    const quantity = maxCraftable(
      { requirements: [{ equipmentId: daggerId }] },
      (state) => {
        state.armory = [
          buildEquipmentItem(daggerId),
          buildEquipmentItem(daggerId),
          buildEquipmentItem(swordId),
        ];
      },
    );

    expect(quantity).toBe(2);
  });

  it('is 0 when a collectible requirement (a possession gate) is not owned', () => {
    expect(maxCraftable({ requirements: [{ collectibleId: toolId }] })).toBe(0);
  });

  it('ignores an owned collectible requirement in the resource math (never consumed)', () => {
    const quantity = maxCraftable(
      { requirements: [{ collectibleId: toolId }] },
      (state) => applyCollectibleGrant(state, toolId, 1),
    );

    expect(quantity).toBe(MAX_CRAFTABLE_CAP);
  });

  it('caps a unique-collectible result to 1 even with abundant resources', () => {
    const quantity = maxCraftable(
      {
        requirements: [{ itemId: oreId, quantity: 1 }],
        result: { collectibleId: effigyId },
      },
      withOre(500),
    );

    expect(quantity).toBe(1);
  });

  it('is 0 for a unique-collectible result that is already owned', () => {
    const quantity = maxCraftable(
      { result: { collectibleId: effigyId } },
      (state) => applyCollectibleGrant(state, effigyId, 1),
    );

    expect(quantity).toBe(0);
  });

  it('is 0 for a unique-collectible result that is already queued', () => {
    const recipe = seedRecipe({ result: { collectibleId: effigyId } });
    seedBlacksmithing({ queue: [entry()] });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(0);
  });
});

describe('craftMaxQueueableQuantity', () => {
  it('caps a single batch at the batch cap', () => {
    expect(craftMaxQueueableQuantity(MAX_CRAFTABLE_CAP + 50)).toBe(
      MAX_CRAFTABLE_CAP,
    );
  });

  it('passes through amounts under the cap', () => {
    expect(craftMaxQueueableQuantity(5)).toBe(5);
  });
});

describe('craftQueueStart', () => {
  const oreRecipe = { requirements: [{ itemId: oreId, quantity: 1 }] };

  function expectRejected(quantity: number): void {
    const before = gamestate();

    expect(queueStart(quantity)).toBe(false);
    expect(gamestate()).toBe(before);
  }

  it('fails when the recipe does not belong to the tradeskill', () => {
    seedRecipe({ tradeskillId: WOODWORKING_ID });
    seedBlacksmithing();

    expectRejected(1);
  });

  it('fails when the building has not reached the recipe level yet', () => {
    seedRecipe({ minTradeskillLevel: 5 });
    seedBlacksmithing({ level: 1 });

    expectRejected(1);
  });

  it('fails when the queue is full and the recipe has no stackable entry', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      { queue: otherRecipeEntries(fullQueueSize()) },
      withOre(100),
    );

    expectRejected(20);
  });

  it('fails when nothing is craftable, even though clamp() alone would let the request through as 1', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing();

    expectRejected(1);
  });

  it('still stacks onto an already-queued recipe when the queue is otherwise full', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      { queue: [entry(), ...otherRecipeEntries(fullQueueSize() - 1)] },
      withOre(100),
    );

    expect(queueStart(1)).toBe(true);
    expect(blacksmithing().queue[0].quantityTotal).toBe(2);
  });

  it('adds to an existing entry for the same recipe instead of queuing a separate one', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      { queue: [entry({ quantityTotal: 2, quantityCompleted: 1 })] },
      withOre(100),
    );

    expect(queueStart(3)).toBe(true);
    expect(blacksmithing().queue).toEqual([
      entry({ quantityTotal: 5, quantityCompleted: 1 }),
    ]);
  });

  it('caps a stacked entry at the batch cap and overflows the remainder into a new entry', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      { queue: [entry({ quantityTotal: MAX_CRAFTABLE_CAP - 9 })] },
      withOre(1000),
    );

    expect(queueStart(20)).toBe(true);
    expect(blacksmithing().queue.map((e) => e.quantityTotal)).toEqual([
      MAX_CRAFTABLE_CAP,
      11,
    ]);
  });

  it('never queues a single new entry past the batch cap even when resources allow more', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing({}, withOre(MAX_CRAFTABLE_CAP * 3));

    expect(queueStart(MAX_CRAFTABLE_CAP * 3)).toBe(true);
    expect(blacksmithing().queue.map((e) => e.quantityTotal)).toEqual([
      MAX_CRAFTABLE_CAP,
    ]);
  });

  it('queues only what fits on the existing stack when the queue has no room for an overflow entry', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      {
        queue: [
          entry({ quantityTotal: MAX_CRAFTABLE_CAP - 9 }),
          ...otherRecipeEntries(fullQueueSize() - 1),
        ],
      },
      withOre(1000),
    );

    expect(queueStart(20)).toBe(true);
    expect(blacksmithing().queue[0].quantityTotal).toBe(MAX_CRAFTABLE_CAP);
    expect(blacksmithing().queue).toHaveLength(fullQueueSize());
    expect(gamestate().materials[oreId]?.quantity).toBe(1000 - 9);
  });

  it('skips a full entry and stacks onto a later entry for the same recipe that has room', () => {
    seedRecipe(oreRecipe);
    seedBlacksmithing(
      {
        queue: [
          entry({
            id: 'capped' as CraftQueueEntryId,
            quantityTotal: MAX_CRAFTABLE_CAP,
          }),
          entry({ id: 'open' as CraftQueueEntryId, quantityTotal: 1 }),
        ],
      },
      (state) => {
        applyMaterialDelta(state, oreId, 1000);
        state.globalEffectSums.tradeskillQueueSizeBoosts[BLACKSMITHING_ID] = 10;
      },
    );

    expect(queueStart(5)).toBe(true);
    expect(blacksmithing().queue.map((e) => e.quantityTotal)).toEqual([
      MAX_CRAFTABLE_CAP,
      6,
    ]);
  });

  it('clamps the requested quantity to what is craftable and reserves materials', () => {
    seedRecipe({ requirements: [{ itemId: oreId, quantity: 2 }] });
    seedBlacksmithing({}, withOre(6));

    expect(queueStart(10)).toBe(true);
    expect(gamestate().materials[oreId]).toBeUndefined();
    expect(blacksmithing().queue).toEqual([
      expect.objectContaining({
        recipeId,
        quantityTotal: 3,
        quantityCompleted: 0,
        ticksIntoCraft: 0,
      }),
    ]);
  });

  it('sends an analytics event with the recipe name when a craft is queued', () => {
    seedRecipe({ name: 'Copper Ingot' });
    seedBlacksmithing();
    const events = captureAnalyticsEvents();

    queueStart(1);

    expect(events).toContain('Kingdom:Craft:Queue:Copper Ingot');
  });
});

describe('craftProcessTick', () => {
  function lastLogIcons() {
    return combatLog()[0]?.itemIcons;
  }

  it('accumulates ticks without resolving until craftTime is reached', () => {
    seedRecipe({ craftTime: 5 });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 2 })] });

    processTick();

    expect(blacksmithing().queue[0].ticksIntoCraft).toBe(3);
    expect(gamestate().materials[ingotId]).toBeUndefined();
  });

  it('completes an item craft: grants the item and XP, logs it, and advances the queue', () => {
    seedRecipe({ result: { itemId: ingotId, quantity: 2 } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });
    const events = captureAnalyticsEvents();

    processTick();

    expect(gamestate().materials[ingotId]?.quantity).toBe(2);
    expect(blacksmithing().xp.current).toBe(1);
    expect(blacksmithing().queue).toEqual([]);
    expect(taskRecordCraft).toHaveBeenCalledWith(recipeId);
    expect(events).toContain('Kingdom:Craft:Complete:Material Copper Ingot');
    expect(lastLogIcons()).toEqual([
      { sprite: 'ingot-sprite', spritesheet: 'item' },
    ]);
  });

  it('completes an equipment craft into the armory', () => {
    seedRecipe({ result: { equipmentId: copperDaggerId } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });

    processTick();

    expect(gamestate().armory.map((item) => item.equipmentId)).toEqual([
      copperDaggerId,
    ]);
    expect(lastLogIcons()).toEqual([
      { sprite: 'dagger-sprite', spritesheet: 'equipment' },
    ]);
  });

  it('completes a collectible craft into the collection', () => {
    seedRecipe({ result: { collectibleId: effigyId } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });

    processTick();

    expect(gamestate().collectibles[effigyId]?.quantity).toBe(1);
    expect(lastLogIcons()).toEqual([
      { sprite: 'effigy-sprite', spritesheet: 'collectible' },
    ]);
  });

  it('produces nothing and grants no XP when both the result and XP rolls fail', () => {
    seedRecipe({ result: { itemId: malachiteId, chance: 10 } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });
    vi.mocked(rngSucceedsChance).mockReturnValue(false);

    processTick();

    expect(gamestate().materials[malachiteId]).toBeUndefined();
    expect(blacksmithing().xp.current).toBe(0);
    expect(blacksmithing().queue).toEqual([]);
    expect(taskRecordCraft).not.toHaveBeenCalled();
  });

  it('still grants XP when the item result chance roll fails but the XP roll succeeds', () => {
    seedRecipe({
      tradeskillXP: 5,
      result: { itemId: malachiteId, chance: 10 },
    });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    processTick();

    expect(gamestate().materials[malachiteId]).toBeUndefined();
    expect(blacksmithing().xp.current).toBe(5);
  });

  it('defaults the result quantity to 1 when the recipe omits it', () => {
    seedRecipe({ result: { itemId: malachiteId, chance: 100 } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] });

    processTick();

    expect(gamestate().materials[malachiteId]?.quantity).toBe(1);
  });

  it('holds an equipment craft at 0 ticks remaining when the armory is full', () => {
    seedRecipe({ result: { equipmentId: copperDaggerId } });
    const armory = fullArmory();
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] }, (state) => {
      state.armory = armory;
    });

    processTick();
    processTick();

    expect(gamestate().armory).toHaveLength(armory.length);
    expect(blacksmithing().queue[0].ticksIntoCraft).toBe(5);
  });

  it('resumes and completes a held equipment craft once armory room frees up', () => {
    seedRecipe({ result: { equipmentId: copperDaggerId } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 5 })] });

    processTick();

    expect(gamestate().armory.map((item) => item.equipmentId)).toEqual([
      copperDaggerId,
    ]);
  });

  it('does not consult armory room for a non-equipment result', () => {
    seedRecipe({ result: { itemId: ingotId, quantity: 1 } });
    seedBlacksmithing({ queue: [entry({ ticksIntoCraft: 4 })] }, (state) => {
      state.armory = fullArmory();
    });

    processTick();

    expect(gamestate().materials[ingotId]?.quantity).toBe(1);
  });

  it('keeps the entry active and resets ticks when more units remain in the batch', () => {
    seedRecipe();
    seedBlacksmithing({
      queue: [entry({ ticksIntoCraft: 4, quantityTotal: 3 })],
    });

    processTick();

    expect(blacksmithing().queue).toEqual([
      entry({ ticksIntoCraft: 0, quantityTotal: 3, quantityCompleted: 1 }),
    ]);
  });
});

describe('reserved equipment', () => {
  const infusedDagger = buildEquipmentItem(daggerId, {
    id: 'dagger-1' as EquipmentItemId,
    infusedItemIds: [oreId],
  });
  const plainDagger = buildEquipmentItem(daggerId, {
    id: 'dagger-2' as EquipmentItemId,
  });
  const sword = buildEquipmentItem(swordId, {
    id: 'sword-1' as EquipmentItemId,
  });

  beforeEach(() => {
    seedRecipe({
      requirements: [{ equipmentId: daggerId }, { itemId: oreId, quantity: 2 }],
      result: { equipmentId: steelDaggerId },
    });
  });

  it('queuing moves the exact armory instances onto the entry', () => {
    seedBlacksmithing({}, (state) => {
      applyMaterialDelta(state, oreId, 100);
      state.armory = [infusedDagger, sword, plainDagger];
    });

    expect(queueStart(2)).toBe(true);
    expect(gamestate().armory).toEqual([sword]);
    expect(blacksmithing().queue[0].reservedEquipment).toEqual([
      infusedDagger,
      plainDagger,
    ]);
  });

  it('completing a unit drops only that unit’s reserved gear', () => {
    seedBlacksmithing({
      queue: [
        entry({
          ticksIntoCraft: 4,
          quantityTotal: 2,
          reservedEquipment: [infusedDagger, plainDagger],
        }),
      ],
    });

    processTick();

    expect(blacksmithing().queue[0].reservedEquipment).toEqual([plainDagger]);
  });

  it('consumes the last unit’s reserved gear when the batch finishes', () => {
    seedBlacksmithing(
      {
        queue: [
          entry({ ticksIntoCraft: 4, reservedEquipment: [infusedDagger] }),
        ],
      },
      (state) => {
        state.armory = [sword];
      },
    );

    processTick();

    expect(blacksmithing().queue).toEqual([]);
    expect(gamestate().armory.map((item) => item.equipmentId)).toEqual([
      swordId,
      steelDaggerId,
    ]);
  });

  it('splits reserved gear between a capped stack and its overflow entry', () => {
    const heldDagger = buildEquipmentItem(daggerId, {
      id: 'dagger-0' as EquipmentItemId,
    });
    seedBlacksmithing(
      {
        queue: [
          entry({
            quantityTotal: MAX_CRAFTABLE_CAP - 1,
            reservedEquipment: [heldDagger],
          }),
        ],
      },
      (state) => {
        applyMaterialDelta(state, oreId, 100);
        state.armory = [infusedDagger, plainDagger];
      },
    );

    expect(queueStart(2)).toBe(true);

    const [stacked, overflow] = blacksmithing().queue;
    expect(stacked.quantityTotal).toBe(MAX_CRAFTABLE_CAP);
    expect(stacked.reservedEquipment).toEqual([heldDagger, infusedDagger]);
    expect(overflow.quantityTotal).toBe(1);
    expect(overflow.reservedEquipment).toEqual([plainDagger]);
  });
});
