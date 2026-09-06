import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import {
  applyTownMaterialDelta,
  depositCommissionRequirementsToTown,
  pruneInvalidTownMaterials,
  townMaterialQuantity,
} from '@helpers/town/town-materials';
import type { EquipmentId, GameState, ItemId, TownId } from '@interfaces';

const townId = 'larsia' as TownId;
const oreId = 'copper-ore' as ItemId;

function buildState(materials: Partial<Record<ItemId, number>>): GameState {
  return {
    world: { towns: { [townId]: { materials } } },
  } as unknown as GameState;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyTownMaterialDelta', () => {
  it('adds a new material entry', () => {
    const state = buildState({});

    applyTownMaterialDelta(state, townId, oreId, 5);

    expect(state.world.towns[townId].materials).toEqual({ [oreId]: 5 });
  });

  it('adds to an existing material entry', () => {
    const state = buildState({ [oreId]: 3 });

    applyTownMaterialDelta(state, townId, oreId, 5);

    expect(state.world.towns[townId].materials).toEqual({ [oreId]: 8 });
  });

  it('clamps at 0 and drops the entry once depleted', () => {
    const state = buildState({ [oreId]: 3 });

    applyTownMaterialDelta(state, townId, oreId, -10);

    expect(state.world.towns[townId].materials).toEqual({});
  });

  it('does nothing when the town has no state entry', () => {
    const state = { world: { towns: {} } } as unknown as GameState;

    expect(() => applyTownMaterialDelta(state, townId, oreId, 5)).not.toThrow();
    expect(state.world.towns[townId]).toBeUndefined();
  });
});

describe('townMaterialQuantity', () => {
  it('returns the stored quantity', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ [oreId]: 12 }));

    expect(townMaterialQuantity(townId, oreId)).toBe(12);
  });

  it('returns 0 when the town or item has no entry', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    expect(townMaterialQuantity(townId, oreId)).toBe(0);
  });
});

describe('depositCommissionRequirementsToTown', () => {
  it('adds each item requirement to the town materials stash', () => {
    const state = buildState({ [oreId]: 3 });

    depositCommissionRequirementsToTown(state, townId, [
      { itemId: oreId, quantity: 5 },
    ]);

    expect(state.world.towns[townId].materials).toEqual({ [oreId]: 8 });
  });

  it('skips equipment and monster-kill requirements', () => {
    const state = buildState({});

    depositCommissionRequirementsToTown(state, townId, [
      { equipmentId: 'sword' as EquipmentId, quantity: 1 },
      { monsterId: 'wolf' as never, quantity: 1, progress: 1 },
    ]);

    expect(state.world.towns[townId].materials).toEqual({});
  });
});

describe('pruneInvalidTownMaterials', () => {
  it('keeps entries that resolve to real content', () => {
    vi.mocked(getEntry).mockReturnValue({} as never);

    expect(pruneInvalidTownMaterials({ [oreId]: 5 })).toEqual({
      [oreId]: 5,
    });
  });

  it('drops entries whose itemId no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(pruneInvalidTownMaterials({ [oreId]: 5 })).toEqual({});
  });
});
