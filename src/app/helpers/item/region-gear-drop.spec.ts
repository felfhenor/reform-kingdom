import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngNumberRange: vi.fn(actual.rngNumberRange) };
});

import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import {
  regionGearCandidates,
  rollRegionGearDrop,
  regionMaterialWeights,
  rollRegionMaterialDrop,
} from '@helpers/item/region-gear-drop';
import { rngNumberRange } from '@helpers/rng';
import type {
  EquipmentId,
  GatheringId,
  ItemId,
  RecipeId,
  ShrineId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const ore = 'ore' as ItemId;
const ingot = 'ingot' as ItemId;

function oreGear(id: string, levelRequirement: number) {
  return [
    ensureEquipment({ id: id as EquipmentId, name: id, levelRequirement }),
    ensureRecipe({
      id: `r-${id}` as RecipeId,
      result: { equipmentId: id as EquipmentId },
      requirements: [{ itemId: ore, quantity: 1 }],
    }),
  ];
}

function withGearChance(chance: number): void {
  seedGamestate((state) => {
    state.globalEffectSums.regionGearDropChance = chance;
  });
}

beforeEach(() => {
  vi.mocked(rngNumberRange).mockClear();
  seedContent([
    ensureGathering({
      id: 'mine' as GatheringId,
      name: 'Mine',
      gatherResults: [
        { chance: 1, items: [{ itemId: ore, quantity: 1 }], tradeskillIds: [] },
      ],
    }),
    ...oreGear('low', 3),
    ...oreGear('high', 20),
    ensureItem({ id: ingot, name: 'Ingot' }),
    ensureRecipe({
      id: 'smelt' as RecipeId,
      result: { itemId: ingot, quantity: 1 },
      requirements: [{ itemId: ore, quantity: 1 }],
    }),
    ensureShrine({
      id: 'shrine' as ShrineId,
      name: 'Shrine',
      levels: [
        ensureShrineLevel({
          developTime: 1,
          costs: [{ itemId: ingot, required: 30 }],
        }),
      ],
    }),
  ]);
  seedWorldNodes([{ name: 'Mine', type: 'GatherNode', mapName: 'Hills' }]);
});

describe('regionGearCandidates', () => {
  it('keeps gear from 2 levels under to 5 over its requirement', () => {
    const ids = (level: number) =>
      regionGearCandidates('Hills', level).map((equipment) => equipment.id);
    expect(ids(1)).toEqual(['low']);
    expect(ids(8)).toEqual(['low']);
    expect(ids(9)).toEqual([]);
    expect(ids(18)).toEqual(['high']);
  });
});

describe('rollRegionGearDrop', () => {
  it('never rolls without the effect', () => {
    withGearChance(0);
    expect(rollRegionGearDrop('Hills', 3)).toEqual([]);
    expect(rngNumberRange).not.toHaveBeenCalled();
  });

  it('adds the equipment bonus to a single roll', () => {
    withGearChance(10);
    vi.mocked(rngNumberRange).mockReturnValueOnce(14).mockReturnValueOnce(14);
    expect(rollRegionGearDrop('Hills', 3)).toEqual([]);
    expect(rollRegionGearDrop('Hills', 3, { Equipment: 5 })).toEqual([
      { kind: 'Equipment', equipmentId: 'low' },
    ]);
  });

  it('drops nothing when no gear fits the level', () => {
    withGearChance(100);
    expect(rollRegionGearDrop('Hills', 50)).toEqual([]);
  });
});

describe('rollRegionMaterialDrop', () => {
  it('rolls separately from gear, sized by the largest cost that needs it', () => {
    withGearChance(0);
    expect(rollRegionMaterialDrop('Hills', 1)).toEqual([]);
    expect(rngNumberRange).not.toHaveBeenCalled();

    seedGamestate((state) => {
      state.globalEffectSums.regionMaterialDropChance = 10;
    });
    vi.mocked(rngNumberRange).mockReturnValueOnce(9);
    expect(rollRegionMaterialDrop('Hills', 1)).toEqual([
      { kind: 'Item', itemId: ingot, quantity: 3 },
    ]);
  });
});

describe('regionMaterialWeights', () => {
  it('floors each material at the pool average demand', () => {
    const home = (id: string) => ({
      item: ensureItem({ id: id as ItemId, name: id }),
      mapName: 'Hills',
      level: 1,
    });
    expect(
      Object.fromEntries(regionMaterialWeights([home('ingot'), home('rare')])),
    ).toEqual({ ingot: 30, rare: 15 });
  });
});
