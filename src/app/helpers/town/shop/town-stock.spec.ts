import { beforeEach, describe, expect, it } from 'vitest';

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { defaultGameState } from '@helpers/defaults';
import {
  applyTownStockAdd,
  pruneInvalidTownStock,
  townStock,
  townStockDisplay,
} from '@helpers/town/shop/town-stock';
import type {
  AffixId,
  EquipmentId,
  GameState,
  TownId,
  TownStockEntry,
} from '@interfaces';
import {
  buildEquipmentItem,
  buildTownNodeState,
  buildTownStockEntry,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const swordId = 'sword' as EquipmentId;
const flamingId = 'flaming' as AffixId;

function stateWithStock(stock: TownStockEntry[]): GameState {
  const state = defaultGameState();
  state.world.towns[townId] = buildTownNodeState({ stock });
  return state;
}

beforeEach(() => {
  seedContent([
    ensureEquipment({ id: swordId, name: 'Iron Sword' }),
    ensureAffix({ id: flamingId, name: 'Flaming', position: 'Prefix' }),
  ]);
});

describe('townStock', () => {
  it("reads the town's stock, or nothing for a town never visited", () => {
    const stock = [buildTownStockEntry(swordId)];
    seedGamestate((state) => {
      state.world.towns[townId] = buildTownNodeState({ stock });
    });

    expect(townStock(townId)).toEqual(stock);
    expect(townStock('other' as TownId)).toEqual([]);
  });
});

describe('townStockDisplay', () => {
  it('shows the rolled instance, affixes included', () => {
    const rolled: TownStockEntry = {
      equipmentItem: buildEquipmentItem(swordId, { affixIds: [flamingId] }),
      addedAtTick: 0,
    };

    expect(townStockDisplay(rolled)?.name).toBe('Flaming Iron Sword');
  });

  it('is undefined once the base equipment no longer resolves', () => {
    expect(
      townStockDisplay(buildTownStockEntry('removed' as EquipmentId)),
    ).toBeUndefined();
  });
});

describe('pruneInvalidTownStock', () => {
  it('drops entries whose equipment no longer resolves, or that predate equipmentItem', () => {
    const kept = buildTownStockEntry(swordId, 5);
    const legacy = { itemId: 'ingot', addedAtTick: 5 } as never;

    expect(
      pruneInvalidTownStock([
        kept,
        buildTownStockEntry('removed' as EquipmentId, 5),
        legacy,
      ]),
    ).toEqual([kept]);
  });

  it('backfills a missing addedAtTick to the current tick rather than zero', () => {
    seedGamestate((state) => (state.clock.numTicks = 500));
    const { equipmentItem } = buildTownStockEntry(swordId);

    expect(
      pruneInvalidTownStock([{ equipmentItem } as TownStockEntry]),
    ).toEqual([{ equipmentItem, addedAtTick: 500 }]);
  });
});

describe('applyTownStockAdd', () => {
  it('appends as its own new entry, stamped with the current tick', () => {
    seedGamestate((state) => (state.clock.numTicks = 42));
    const existing = buildTownStockEntry(swordId);
    const state = stateWithStock([existing]);
    const { equipmentItem } = buildTownStockEntry(swordId);

    applyTownStockAdd(state, townId, { equipmentItem }, 10);

    expect(state.world.towns[townId].stock).toEqual([
      existing,
      { equipmentItem, addedAtTick: 42 },
    ]);
  });

  it('refuses the addition once at cap', () => {
    const state = stateWithStock([buildTownStockEntry(swordId)]);

    applyTownStockAdd(
      state,
      townId,
      { equipmentItem: buildEquipmentItem(swordId) },
      1,
    );

    expect(state.world.towns[townId].stock).toHaveLength(1);
  });

  it('does nothing for a town never visited', () => {
    const state = defaultGameState();

    applyTownStockAdd(
      state,
      townId,
      { equipmentItem: buildEquipmentItem(swordId) },
      10,
    );

    expect(state.world.towns).toEqual({});
  });
});
