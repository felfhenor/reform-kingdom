import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { pruneInvalidTowns } from '@helpers/town/town-prune';
import type {
  EquipmentId,
  GameStateTowns,
  ItemId,
  TownContent,
  TownId,
  TradeskillId,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState, buildTownStockEntry } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const townId = 'larsia' as TownId;
const darwinId = 'darwin' as WorkerId;
const newHireId = 'new-hire' as WorkerId;
const oreId = 'copper-ore' as ItemId;
const swordId = 'sword' as EquipmentId;
const blacksmithingId = 'blacksmithing' as TradeskillId;

function seedTown(workers: WorkerId[] = [darwinId]): void {
  seedContent([
    ensureTown({
      id: townId,
      gathering: {
        workers: workers.map((workerId) => ({ workerId, level: 1 })),
      } as unknown as TownContent['gathering'],
    }),
    ensureItem({ id: oreId }),
    ensureEquipment({ id: swordId }),
    ensureTradeskill({ id: blacksmithingId, name: 'Blacksmithing' }),
  ]);
}

function prunedTown(towns: GameStateTowns) {
  return pruneInvalidTowns(towns)[townId];
}

beforeEach(() => seedTown());

describe('pruneInvalidTowns', () => {
  it('drops towns whose id no longer resolves to content', () => {
    expect(
      pruneInvalidTowns({ ['gone' as TownId]: buildTownNodeState() }),
    ).toEqual({});
  });

  it('keeps existing progress on a valid town', () => {
    const existing = buildTownNodeState({
      lastProcessedTick: { worker: 42 },
      reputation: 350,
      hiddenGold: 1200,
      materials: { [oreId]: 8 },
      stock: [buildTownStockEntry(swordId, 3)],
    });

    expect(prunedTown({ [townId]: existing })).toMatchObject({
      lastProcessedTick: { worker: 42 },
      reputation: 350,
      hiddenGold: 1200,
      materials: { [oreId]: 8 },
      stock: existing.stock,
    });
  });

  it('backfills every missing field on a legacy entry', () => {
    const legacy = { [townId]: {} } as unknown as GameStateTowns;

    expect(prunedTown(legacy)).toMatchObject(
      buildTownNodeState({ workers: prunedTown(legacy).workers }),
    );
  });

  it('drops materials and stock that no longer resolve to content', () => {
    const result = prunedTown({
      [townId]: buildTownNodeState({
        materials: { [oreId]: 5, ['gone' as ItemId]: 2 },
        stock: [
          buildTownStockEntry(swordId),
          buildTownStockEntry('gone' as EquipmentId),
        ],
      }),
    });

    expect(result.materials).toEqual({ [oreId]: 5 });
    expect(
      result.stock.map((entry) => entry.equipmentItem.equipmentId),
    ).toEqual([swordId]);
  });

  it('drops tradeskills that no longer exist and re-seeds known ones from content', () => {
    const tradeskills = prunedTown({
      [townId]: buildTownNodeState({
        tradeskills: { ['gone' as TradeskillId]: { level: 3 } },
      }),
    }).tradeskills;

    expect(tradeskills).toEqual({ [blacksmithingId]: { level: 1 } });
  });

  it('drops workers no longer on the roster and adds newly-authored ones', () => {
    seedTown([darwinId, newHireId]);
    const darwin = { level: 4 } as never;

    const workers = prunedTown({
      [townId]: buildTownNodeState({
        workers: { [darwinId]: darwin, ['removed' as WorkerId]: darwin },
      }),
    }).workers;

    expect(Object.keys(workers).sort()).toEqual([darwinId, newHireId]);
    expect(workers[darwinId]).toBe(darwin);
  });
});
