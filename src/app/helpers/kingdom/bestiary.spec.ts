import { defaultCombatStats } from '@helpers/defaults';
import type * as AnalyticsHelper from '@helpers/engine/analytics';
import type {
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  EncounterRandomId,
  GameState,
  GameStateBestiary,
  ItemId,
  MonsterContent,
  MonsterId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
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
import { gamestate, updateGamestate } from '@helpers/state-game';

const goblin: MonsterContent = {
  id: 'goblin' as MonsterId,
  name: 'Goblin',
  __type: 'monster',
  description: 'A sneaky goblin.',
  sprite: '0000',
  frames: 4,
  rarity: 'Common',
  baseStats: {
    Health: 10,
    Energy: 0,
    Luck: 0,
    Intelligence: 0,
    Strength: 1,
    Vitality: 0,
    Resistance: 0,
    Agility: 1,
    Constitution: 0,
    Spirit: 0,
  },
  statsPerLevel: {
    Health: 0,
    Energy: 0,
    Luck: 0,
    Intelligence: 0,
    Strength: 0,
    Vitality: 0,
    Resistance: 0,
    Agility: 0,
    Constitution: 0,
    Spirit: 0,
  },
  combatStats: defaultCombatStats(),
  targetting: [{ type: 'Random' }],
  xp: { min: 3, max: 5, bonusPerLevel: 1 },
  drops: [
    ensureDroppedReward({
      itemId: 'gold-coin' as ItemId,
      min: 3,
      max: 10,
      bonusPerLevel: 1,
      chance: 100,
    }),
  ],
  skills: [],
  types: [],
};

const fieldRuinsEncounter: EncounterContent = {
  id: 'field-ruins' as EncounterId,
  name: 'Field Ruins',
  __type: 'encounter',
  description: 'A ruined field.',
  levelRange: { min: 1, max: 5 },
  fights: [{ monsters: [{ monsterId: goblin.id }] }],
  completionRewards: [],
};

const swampEncounter: EncounterContent = {
  id: 'swamp' as EncounterId,
  name: 'Swamp',
  __type: 'encounter',
  description: 'A murky swamp.',
  levelRange: { min: 4, max: 8 },
  fights: [{ monsters: [] }],
  completionRewards: [],
};

const wildsEncounterRandom: EncounterRandomContent = {
  id: 'wilds' as EncounterRandomId,
  name: 'The Wilds',
  __type: 'encounterrandom',
  description: 'An untamed wilderness.',
  resetTime: 100,
  levelRange: { min: 2, max: 6 },
  encounterRange: { min: 1, max: 1 },
  combatantRange: { min: 1, max: 1 },
  creaturePool: [{ monsterId: goblin.id, weight: 1 }],
  fights: [],
  completionRewards: [],
};

describe('Bestiary Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isMonsterDiscovered', () => {
    it('returns true when foundAt is set', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 1,
            minLevelFound: 1,
            maxLevelFound: 1,
            foundAtNodes: [],
          },
        },
      } as unknown as GameState);

      expect(isMonsterDiscovered(goblin.id)).toBe(true);
    });

    it('returns false when the monster has never been killed', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);

      expect(isMonsterDiscovered(goblin.id)).toBe(false);
    });
  });

  describe('getMonsterKillCount', () => {
    it('returns the stored kill count', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 4,
            minLevelFound: 1,
            maxLevelFound: 3,
            foundAtNodes: [],
          },
        },
      } as unknown as GameState);

      expect(getMonsterKillCount(goblin.id)).toBe(4);
    });

    it('returns 0 when the monster has never been killed', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);

      expect(getMonsterKillCount(goblin.id)).toBe(0);
    });
  });

  describe('getMonsterFoundAtNodes', () => {
    it('returns every place the monster has been killed at', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 2,
            minLevelFound: 1,
            maxLevelFound: 2,
            foundAtNodes: ['Field Ruins', 'Swamp'],
          },
        },
      } as unknown as GameState);

      expect(getMonsterFoundAtNodes(goblin.id)).toEqual([
        'Field Ruins',
        'Swamp',
      ]);
    });

    it('returns an empty array when the monster has never been killed', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);

      expect(getMonsterFoundAtNodes(goblin.id)).toEqual([]);
    });
  });

  describe('getMonsterLevelRangeFound', () => {
    it('returns the min/max level actually fought at', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 3,
            minLevelFound: 2,
            maxLevelFound: 7,
            foundAtNodes: [],
          },
        },
      } as unknown as GameState);

      expect(getMonsterLevelRangeFound(goblin.id)).toEqual({ min: 2, max: 7 });
    });

    it('returns undefined when the monster has never been killed', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);

      expect(getMonsterLevelRangeFound(goblin.id)).toBeUndefined();
    });
  });

  describe('monsterRecordKill', () => {
    it('creates a new entry on the first kill', () => {
      monsterRecordKill(goblin.id, 3, 'Field Ruins');

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({ bestiary: {} } as unknown as GameState);

      expect(result.bestiary[goblin.id]).toEqual({
        foundAt: expect.any(Number),
        kills: 1,
        minLevelFound: 3,
        maxLevelFound: 3,
        foundAtNodes: ['Field Ruins'],
      });
    });

    it('increments kills and expands the min/max level found', () => {
      monsterRecordKill(goblin.id, 7, 'Swamp');

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 2,
            minLevelFound: 3,
            maxLevelFound: 5,
            foundAtNodes: ['Field Ruins'],
          },
        },
      } as unknown as GameState);

      expect(result.bestiary[goblin.id]).toEqual({
        foundAt: 1000,
        kills: 3,
        minLevelFound: 3,
        maxLevelFound: 7,
        foundAtNodes: ['Field Ruins', 'Swamp'],
      });
    });

    it('narrows the min level when killed at a lower level than before', () => {
      monsterRecordKill(goblin.id, 1);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 1,
            minLevelFound: 5,
            maxLevelFound: 5,
            foundAtNodes: [],
          },
        },
      } as unknown as GameState);

      expect(result.bestiary[goblin.id].minLevelFound).toBe(1);
      expect(result.bestiary[goblin.id].maxLevelFound).toBe(5);
    });

    it('treats a corrupted (NaN) existing range as unset instead of propagating NaN', () => {
      monsterRecordKill(goblin.id, 4);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 1,
            minLevelFound: NaN,
            maxLevelFound: NaN,
            foundAtNodes: [],
          },
        },
      } as unknown as GameState);

      expect(result.bestiary[goblin.id].minLevelFound).toBe(4);
      expect(result.bestiary[goblin.id].maxLevelFound).toBe(4);
    });

    it('treats a pre-level-tracking entry (missing min/max) as unset instead of propagating NaN', () => {
      monsterRecordKill(goblin.id, 4);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: {
          [goblin.id]: { foundAt: 1000, kills: 1 },
        },
      } as unknown as GameState);

      expect(result.bestiary[goblin.id].minLevelFound).toBe(4);
      expect(result.bestiary[goblin.id].maxLevelFound).toBe(4);
    });

    it('does not duplicate a location it has already been found at', () => {
      monsterRecordKill(goblin.id, 3, 'Field Ruins');

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 1,
            minLevelFound: 3,
            maxLevelFound: 3,
            foundAtNodes: ['Field Ruins'],
          },
        },
      } as unknown as GameState);

      expect(result.bestiary[goblin.id].foundAtNodes).toEqual(['Field Ruins']);
    });

    it('sends an analytics event with the monster name only on the first kill', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(goblin);

      monsterRecordKill(goblin.id, 3, 'Field Ruins');

      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Progress:Bestiary:Unlock:Goblin',
      );
    });

    it('does not send an analytics event again on repeat kills', () => {
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 1,
            minLevelFound: 3,
            maxLevelFound: 3,
            foundAtNodes: ['Field Ruins'],
          },
        },
      } as unknown as GameState);

      monsterRecordKill(goblin.id, 3, 'Field Ruins');

      expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidBestiaryEntries', () => {
    const entry = {
      foundAt: 1000,
      kills: 1,
      minLevelFound: 1,
      maxLevelFound: 1,
      foundAtNodes: [],
    };

    it('keeps entries that resolve to real monster content', () => {
      vi.mocked(getEntry).mockReturnValue(goblin);
      const bestiary: GameStateBestiary = { [goblin.id]: entry };

      expect(pruneInvalidBestiaryEntries(bestiary)).toEqual(bestiary);
    });

    it('drops entries whose monsterId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const bestiary: GameStateBestiary = { [goblin.id]: entry };

      expect(pruneInvalidBestiaryEntries(bestiary)).toEqual({});
    });
  });

  describe('repairInvalidBestiaryLevels', () => {
    it('leaves an entry with a valid min/max level range untouched', () => {
      const bestiary: GameStateBestiary = {
        [goblin.id]: {
          foundAt: 1000,
          kills: 2,
          minLevelFound: 2,
          maxLevelFound: 5,
          foundAtNodes: ['Field Ruins'],
        },
      };

      expect(repairInvalidBestiaryLevels(bestiary)).toEqual(bestiary);
    });

    it('collapses a NaN range to a single unknown level', () => {
      const bestiary: GameStateBestiary = {
        [goblin.id]: {
          foundAt: 1000,
          kills: 2,
          minLevelFound: NaN,
          maxLevelFound: NaN,
          foundAtNodes: ['Field Ruins'],
        },
      };

      expect(repairInvalidBestiaryLevels(bestiary)).toEqual({
        [goblin.id]: {
          foundAt: 1000,
          kills: 2,
          minLevelFound: 1,
          maxLevelFound: 1,
          foundAtNodes: ['Field Ruins'],
        },
      });
    });

    it('backfills a pre-level-tracking entry missing min/max entirely', () => {
      const bestiary = {
        [goblin.id]: { foundAt: 1000, kills: 2, foundAtNodes: [] },
      } as unknown as GameStateBestiary;

      expect(repairInvalidBestiaryLevels(bestiary)).toEqual({
        [goblin.id]: {
          foundAt: 1000,
          kills: 2,
          foundAtNodes: [],
          minLevelFound: 1,
          maxLevelFound: 1,
        },
      });
    });
  });

  describe('monsterSourceNodeNames', () => {
    it('includes static encounters that place the monster in a fight', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) =>
          (type === 'encounter'
            ? [fieldRuinsEncounter, swampEncounter]
            : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual(['Field Ruins']);
    });

    it('includes encounter-random nodes whose creature pool has the monster', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) =>
          (type === 'encounterrandom' ? [wildsEncounterRandom] : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual(['The Wilds']);
    });

    it('returns an empty array when the monster appears nowhere', () => {
      vi.mocked(getEntriesByType).mockImplementation(
        (type) => (type === 'encounter' ? [swampEncounter] : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual([]);
    });
  });
});
