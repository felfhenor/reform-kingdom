import { describe, expect, it } from 'vitest';

import {
  backfillReservedEquipment,
  refundQueueEntry,
  reservedEquipmentIdsFor,
  splitReservedEquipment,
} from '@helpers/crafting/crafting-reserved-equipment';
import type {
  AffixId,
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentId,
  EquipmentItemId,
  GameState,
  ItemId,
  RecipeId,
  TradeskillId,
} from '@interfaces';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { defaultGameState } from '@helpers/defaults';
import { buildCraftQueueEntry, buildEquipmentItem } from '@/testing/builders';

const infusedDagger = buildEquipmentItem('dagger' as EquipmentId, {
  id: 'dagger-1' as EquipmentItemId,
  infusedItemIds: ['ember' as ItemId],
  affixIds: ['sharp' as AffixId],
});
const plainDagger = buildEquipmentItem('dagger' as EquipmentId, {
  id: 'dagger-2' as EquipmentItemId,
});
const sword = buildEquipmentItem('sword' as EquipmentId, {
  id: 'sword-1' as EquipmentItemId,
});

const upgradeRecipe = ensureRecipe({
  id: 'recipe-1' as RecipeId,
  name: 'Weapon: Steel Dagger',
  result: { equipmentId: 'steel-dagger' as EquipmentId },
  requirements: [
    { equipmentId: 'dagger' as EquipmentId },
    { itemId: 'ore' as ItemId, quantity: 2 },
  ],
  tradeskillId: 'blacksmithing-id' as TradeskillId,
});

function buildQueueEntry(
  overrides: Partial<CraftQueueEntry> = {},
): CraftQueueEntry {
  return buildCraftQueueEntry({
    id: 'queue-entry-1' as CraftQueueEntryId,
    recipeId: 'recipe-1' as RecipeId,
    ...overrides,
  });
}

function buildState(armory: GameState['armory'] = []): GameState {
  const state = defaultGameState();
  state.armory = armory;
  return state;
}

describe('refundQueueEntry', () => {
  it('returns the reserved instances untouched plus unspent materials', () => {
    const state = buildState([sword]);

    refundQueueEntry(
      state,
      buildQueueEntry({
        quantityTotal: 3,
        quantityCompleted: 1,
        reservedEquipment: [infusedDagger, plainDagger],
      }),
      upgradeRecipe,
    );

    expect(state.armory).toEqual([sword, infusedDagger, plainDagger]);
    expect(state.materials['ore' as ItemId]?.quantity).toBe(4);
  });

  it('never mints gear beyond what the entry actually holds', () => {
    const state = buildState();

    refundQueueEntry(
      state,
      buildQueueEntry({ quantityTotal: 2, reservedEquipment: [plainDagger] }),
      upgradeRecipe,
    );

    expect(state.armory).toEqual([plainDagger]);
  });

  it('still returns reserved gear when the recipe no longer exists', () => {
    const state = buildState();

    refundQueueEntry(
      state,
      buildQueueEntry({ reservedEquipment: [infusedDagger] }),
    );

    expect(state.armory).toEqual([infusedDagger]);
  });
});

describe('splitReservedEquipment', () => {
  it('takes the first matching instance per id and keeps the rest in order', () => {
    expect(
      splitReservedEquipment([infusedDagger, sword, plainDagger], [
        'dagger',
        'dagger',
        'dagger',
      ] as EquipmentId[]),
    ).toEqual({ taken: [infusedDagger, plainDagger], rest: [sword] });
  });
});

describe('reservedEquipmentIdsFor', () => {
  it('lists one id per consumed instance, repeating duplicate requirements', () => {
    const recipe = {
      ...upgradeRecipe,
      requirements: [
        ...upgradeRecipe.requirements,
        { equipmentId: 'dagger' as EquipmentId },
      ],
    };

    expect(reservedEquipmentIdsFor(recipe, 2)).toEqual([
      'dagger',
      'dagger',
      'dagger',
      'dagger',
    ]);
  });
});

describe('backfillReservedEquipment', () => {
  it('keeps an entry’s existing reservation as-is', () => {
    const entry = buildQueueEntry({ reservedEquipment: [infusedDagger] });

    expect(backfillReservedEquipment(entry, upgradeRecipe)).toBe(
      entry.reservedEquipment,
    );
  });

  it('mints stand-ins for the unfinished units of a pre-reservation entry', () => {
    const legacy = {
      ...buildQueueEntry({ quantityTotal: 3, quantityCompleted: 1 }),
      reservedEquipment: undefined,
    } as unknown as CraftQueueEntry;

    const result = backfillReservedEquipment(legacy, upgradeRecipe);

    expect(result.map((item) => item.equipmentId)).toEqual([
      'dagger',
      'dagger',
    ]);
  });
});
