import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import {
  ensureEncounter,
  ensureEncounterRandom,
} from '@helpers/content/ensure-encounternode';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  getMonsterFoundAtNodes,
  getMonsterKillCount,
  getMonsterLevelRangeFound,
  isMonsterDiscovered,
  monsterRecordKill,
  monsterSourceNodeNames,
  pruneInvalidBestiaryEntries,
  repairInvalidBestiaryLevels,
} from '@helpers/kingdom/bestiary';
import { bestiaryState } from '@helpers/state-game';
import { taskEventMonsterKilled } from '@helpers/task/task-events';
import type {
  EncounterId,
  EncounterRandomId,
  GameStateBestiary,
  MonsterId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const goblinId = 'goblin' as MonsterId;
const staleId = 'stale' as MonsterId;

function entry(
  overrides: Partial<GameStateBestiary[MonsterId]> = {},
): GameStateBestiary[MonsterId] {
  return {
    foundAt: 1000,
    kills: 1,
    minLevelFound: 3,
    maxLevelFound: 3,
    foundAtNodes: [],
    ...overrides,
  };
}

function seedGoblin(overrides?: Partial<GameStateBestiary[MonsterId]>): void {
  seedGamestate((state) => {
    if (overrides) state.bestiary[goblinId] = entry(overrides);
  });
}

function recordKill(
  level: number,
  node?: string,
): GameStateBestiary[MonsterId] {
  inTick(() => monsterRecordKill(goblinId, level, node));
  return bestiaryState()[goblinId];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(5000);
  seedContent([ensureMonster({ id: goblinId, name: 'Goblin' })]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading the bestiary', () => {
  it('reports discovery, kills, locations and the level range fought at', () => {
    seedGoblin({
      kills: 4,
      minLevelFound: 2,
      maxLevelFound: 7,
      foundAtNodes: ['Field Ruins', 'Swamp'],
    });

    expect(isMonsterDiscovered(goblinId)).toBe(true);
    expect(getMonsterKillCount(goblinId)).toBe(4);
    expect(getMonsterFoundAtNodes(goblinId)).toEqual(['Field Ruins', 'Swamp']);
    expect(getMonsterLevelRangeFound(goblinId)).toEqual({ min: 2, max: 7 });
  });

  it('reports nothing for a monster never killed', () => {
    seedGoblin();

    expect(isMonsterDiscovered(goblinId)).toBe(false);
    expect(getMonsterKillCount(goblinId)).toBe(0);
    expect(getMonsterFoundAtNodes(goblinId)).toEqual([]);
    expect(getMonsterLevelRangeFound(goblinId)).toBeUndefined();
  });
});

describe('monsterRecordKill', () => {
  it('creates a new entry on the first kill', () => {
    seedGoblin();

    expect(recordKill(3, 'Field Ruins')).toEqual(
      entry({ foundAt: 5000, foundAtNodes: ['Field Ruins'] }),
    );
  });

  it('increments kills and widens the level range in both directions', () => {
    seedGoblin({ kills: 2, minLevelFound: 3, maxLevelFound: 5 });

    recordKill(7);
    const result = recordKill(1);

    expect(result).toMatchObject({
      foundAt: 1000,
      kills: 4,
      minLevelFound: 1,
      maxLevelFound: 7,
    });
  });

  it('adds each new location once', () => {
    seedGoblin({ foundAtNodes: ['Field Ruins'] });

    recordKill(3, 'Field Ruins');
    const result = recordKill(3, 'Swamp');

    expect(result.foundAtNodes).toEqual(['Field Ruins', 'Swamp']);
  });

  it('treats a non-finite or missing existing range as unset', () => {
    seedGoblin({ minLevelFound: NaN, maxLevelFound: undefined as never });

    expect(recordKill(4)).toMatchObject({ minLevelFound: 4, maxLevelFound: 4 });
  });

  it('reports the new lifetime kill total to the task system', () => {
    seedGoblin({ kills: 4 });

    recordKill(3);

    expect(taskEventMonsterKilled).toHaveBeenCalledWith(goblinId, 5);
  });

  it('waits for a deferred write before reporting the kill total', async () => {
    seedGoblin();

    monsterRecordKill(goblinId, 3);
    expect(taskEventMonsterKilled).not.toHaveBeenCalled();

    await vi.waitFor(() =>
      expect(taskEventMonsterKilled).toHaveBeenCalledWith(goblinId, 1),
    );
  });

  it('sends the bestiary unlock event only on the first kill', () => {
    seedGoblin();
    const events = captureAnalyticsEvents();

    recordKill(3);
    recordKill(3);

    expect(events).toEqual(['Progress:Bestiary:Unlock:Goblin']);
  });
});

describe('pruneInvalidBestiaryEntries', () => {
  it('drops only the entries that no longer resolve to content', () => {
    expect(
      pruneInvalidBestiaryEntries({ [goblinId]: entry(), [staleId]: entry() }),
    ).toEqual({ [goblinId]: entry() });
  });
});

describe('repairInvalidBestiaryLevels', () => {
  it('leaves an entry with a valid level range untouched', () => {
    const bestiary = {
      [goblinId]: entry({ minLevelFound: 2, maxLevelFound: 5 }),
    };

    expect(repairInvalidBestiaryLevels(bestiary)).toEqual(bestiary);
  });

  it('collapses a non-finite or missing range to a single unknown level', () => {
    const repaired = repairInvalidBestiaryLevels({
      [goblinId]: entry({ minLevelFound: NaN, maxLevelFound: 5 }),
      [staleId]: { foundAt: 1000, kills: 2, foundAtNodes: [] } as never,
    });

    expect(repaired[goblinId]).toMatchObject({
      minLevelFound: 1,
      maxLevelFound: 1,
    });
    expect(repaired[staleId]).toMatchObject({
      kills: 2,
      minLevelFound: 1,
      maxLevelFound: 1,
    });
  });
});

describe('monsterSourceNodeNames', () => {
  it('lists static encounters that fight the monster and random nodes that pool it', () => {
    seedContent([
      ensureEncounter({
        id: 'field-ruins' as EncounterId,
        name: 'Field Ruins',
        fights: [{ monsters: [{ monsterId: goblinId }] }],
      }),
      ensureEncounter({
        id: 'swamp' as EncounterId,
        name: 'Swamp',
        fights: [{ monsters: [{ monsterId: staleId }] }],
      }),
      ensureEncounterRandom({
        id: 'wilds' as EncounterRandomId,
        name: 'The Wilds',
        creaturePool: [{ monsterId: goblinId, weight: 1 }],
      }),
    ]);

    expect(monsterSourceNodeNames(goblinId)).toEqual([
      'Field Ruins',
      'The Wilds',
    ]);
  });

  it('is empty when the monster appears nowhere', () => {
    seedContent([
      ensureEncounter({ id: 'swamp' as EncounterId, name: 'Swamp' }),
    ]);

    expect(monsterSourceNodeNames(goblinId)).toEqual([]);
  });
});
