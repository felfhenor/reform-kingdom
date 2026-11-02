import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { ensureWorldNodeDevelopmentLevel } from '@helpers/content/ensure-helpers-core';
import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import { ensureTask } from '@helpers/content/ensure-task';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { ledgerMark } from '@helpers/engine/ledger';
import {
  remembranceBestiary,
  remembranceCollectibles,
  remembranceDevelopment,
  remembranceEquipment,
  remembranceMaterials,
  remembranceTasks,
  remembranceWorkers,
} from '@helpers/remembrance/remembrance';
import type {
  CollectibleId,
  EquipmentId,
  GatheringId,
  ItemId,
  MonsterId,
  OutpostId,
  ShrineId,
  TaskId,
  TownId,
  WorkerId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const relicId = 'relic' as CollectibleId;
const swordId = 'sword' as EquipmentId;
const oreId = 'ore' as ItemId;
const debugItemId = 'debug' as ItemId;
const goblinId = 'goblin' as MonsterId;
const rescuedId = 'rescued' as WorkerId;
const townWorkerId = 'town-worker' as WorkerId;
const taskId = 'task' as TaskId;
const developmentLevel = ensureWorldNodeDevelopmentLevel({});

beforeEach(() => {
  seedContent([
    ensureCollectible({ id: relicId, name: 'Relic' }),
    ensureCollectible({ id: 'lost' as CollectibleId, name: 'Lost' }),
    ensureEquipment({ id: swordId, name: 'Sword' }),
    ensureItem({ id: oreId, name: 'Ore' }),
    ensureItem({ id: debugItemId, name: 'Debug', unobtainable: true }),
    ensureMonster({ id: goblinId, name: 'Goblin' }),
    ensureWorker({ id: rescuedId, name: 'Rescued' }),
    ensureWorker({ id: townWorkerId, name: 'Town Worker' }),
    ensureTown({
      id: 'town' as TownId,
      name: 'Town',
      gathering: { workers: [{ workerId: townWorkerId }] },
    }),
    ensureShrine({
      id: 'shrine-a' as ShrineId,
      name: 'Shrine A',
      levels: [ensureShrineLevel(), ensureShrineLevel(), ensureShrineLevel()],
    }),
    ensureShrine({
      id: 'shrine-b' as ShrineId,
      name: 'Shrine B',
      levels: [ensureShrineLevel(), ensureShrineLevel()],
    }),
    ensureOutpost({
      id: 'outpost' as OutpostId,
      name: 'Outpost',
      levels: [developmentLevel, developmentLevel],
    }),
    ensureGathering({
      id: 'grove' as GatheringId,
      name: 'Grove',
      levels: [developmentLevel],
    }),
    ensureTask({ id: taskId, name: 'Task' }),
    ensureTask({ id: 'open' as TaskId, name: 'Open Task' }),
  ]);
});

describe('remembrance discovery categories', () => {
  it('counts each found entry once', () => {
    seedGamestate((state) => {
      state.collectibles[relicId] = { quantity: 3, foundAt: 1 };
      ledgerMark(state.discoveredEquipment, swordId);
    });

    expect(remembranceCollectibles()).toMatchObject({ current: 1, max: 2 });
    expect(remembranceEquipment()).toMatchObject({ current: 1, max: 1 });
  });

  it('leaves unobtainable content out of the total', () => {
    seedGamestate((state) => ledgerMark(state.discoveredMaterials, oreId));

    expect(remembranceMaterials()).toMatchObject({ current: 1, max: 1 });
  });

  it('counts a monster once it is in the bestiary', () => {
    seedGamestate((state) => {
      state.bestiary[goblinId] = {
        foundAt: 1,
        kills: 4,
        minLevelFound: 1,
        maxLevelFound: 1,
        foundAtNodes: [],
      };
    });

    expect(remembranceBestiary()).toMatchObject({ current: 1, max: 1 });
  });

  it('only counts workers that can be rescued', () => {
    seedGamestate((state) => ledgerMark(state.discoveredWorkers, rescuedId));

    expect(remembranceWorkers()).toMatchObject({ current: 1, max: 1 });
  });

  it('counts completed tasks, claimed or not', () => {
    seedGamestate((state) => {
      state.tasks[taskId] = { progress: 0, completedAt: 5 };
    });

    expect(remembranceTasks()).toMatchObject({ current: 1, max: 2 });
  });
});

describe('remembranceDevelopment', () => {
  it('sums levels across every node of the type', () => {
    seedGamestate((state) => {
      state.shrines['Shrine A'] = { level: 2 };
      state.shrines['Shrine B'] = { level: 2 };
    });

    expect(remembranceDevelopment('shrine')).toMatchObject({
      name: 'Shrine Development',
      current: 4,
      max: 5,
    });
  });

  it('caps a stale level at the node max', () => {
    seedGamestate((state) => {
      state.outposts['Outpost'] = { level: 9 };
    });

    expect(remembranceDevelopment('outpost')).toMatchObject({
      current: 2,
      max: 2,
    });
  });

  it('treats an undeveloped node as level 0', () => {
    seedGamestate();

    expect(remembranceDevelopment('gathering')).toMatchObject({
      current: 0,
      max: 1,
    });
  });
});
