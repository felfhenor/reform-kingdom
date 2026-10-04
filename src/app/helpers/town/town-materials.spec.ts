import { describe, expect, it } from 'vitest';

import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import {
  applyTownMaterialDelta,
  depositCommissionRequirementsToTown,
  pruneInvalidTownMaterials,
  townDefaultMaterials,
  townMaterialQuantity,
} from '@helpers/town/town-materials';
import type {
  EquipmentId,
  GameState,
  ItemId,
  MonsterId,
  TownId,
  TownMaterials,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const ore = 'copper-ore' as ItemId;

function stateWith(materials: TownMaterials): GameState {
  const state = defaultGameState();
  state.world.towns[townId] = buildTownNodeState({ materials });
  return state;
}

const materialsOf = (state: GameState) => state.world.towns[townId].materials;

describe('applyTownMaterialDelta', () => {
  it('adds to the stash, dropping an entry once it runs out', () => {
    const state = stateWith({});

    applyTownMaterialDelta(state, townId, ore, 5);
    applyTownMaterialDelta(state, townId, ore, 3);
    expect(materialsOf(state)).toEqual({ [ore]: 8 });

    applyTownMaterialDelta(state, townId, ore, -10);
    expect(materialsOf(state)).toEqual({});
  });

  it('ignores a town with no state yet', () => {
    const state = defaultGameState();

    applyTownMaterialDelta(state, townId, ore, 5);

    expect(state.world.towns[townId]).toBeUndefined();
  });
});

describe('townMaterialQuantity', () => {
  it('reads the stash, 0 for anything not held', () => {
    seedGamestate(
      (state) =>
        (state.world.towns[townId] = buildTownNodeState({
          materials: { [ore]: 12 },
        })),
    );

    expect(townMaterialQuantity(townId, ore)).toBe(12);
    expect(townMaterialQuantity(townId, 'amber' as ItemId)).toBe(0);
    expect(townMaterialQuantity('unvisited' as TownId, ore)).toBe(0);
  });
});

describe('depositCommissionRequirementsToTown', () => {
  it('stashes item requirements only', () => {
    const state = stateWith({ [ore]: 3 });

    depositCommissionRequirementsToTown(state, townId, [
      { itemId: ore, quantity: 5 },
      { equipmentId: 'sword' as EquipmentId, quantity: 1 },
      { monsterId: 'wolf' as MonsterId, quantity: 1, progress: 1 },
    ]);

    expect(materialsOf(state)).toEqual({ [ore]: 8 });
  });
});

describe('pruneInvalidTownMaterials', () => {
  it('drops materials gone from content', () => {
    seedContent([ensureItem({ id: ore, name: 'Copper Ore' })]);

    expect(
      pruneInvalidTownMaterials({ [ore]: 5, ['gone' as ItemId]: 2 }),
    ).toEqual({ [ore]: 5 });
  });
});

describe('townDefaultMaterials', () => {
  it('starts the stash from each threshold with a positive default', () => {
    const town = ensureTown({
      materialThresholds: [
        { itemId: ore, default: 30 },
        { itemId: 'amber' as ItemId },
      ],
    });

    expect(townDefaultMaterials(town)).toEqual({ [ore]: 30 });
  });
});
