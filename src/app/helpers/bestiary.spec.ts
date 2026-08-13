import type {
  BestiaryEntry,
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

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node-rewards', () => ({
  isRewardDiscovered: vi.fn(),
  rewardContentInfo: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeDisplayName: vi.fn((nodeName: string) => nodeName),
}));

import {
  bestiaryDropQuantityLabel,
  bestiaryXpLabel,
  filterBestiaryEntries,
  getBestiaryEntries,
  getMonsterFoundAtNodes,
  getMonsterKillCount,
  getMonsterLevelRangeFound,
  isMonsterDiscovered,
  monsterRecordKill,
  monsterSourceNodeNames,
  pruneInvalidBestiaryEntries,
  repairInvalidBestiaryLevels,
} from '@helpers/bestiary';
import { getEntriesByType, getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { isRewardDiscovered, rewardContentInfo } from '@helpers/world-node-rewards';

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
  },
  targettingType: 'Random',
  xp: { min: 3, max: 5, bonusPerLevel: 1 },
  drops: [
    {
      itemId: 'gold-coin' as ItemId,
      min: 3,
      max: 10,
      bonusPerLevel: 1,
      chance: 100,
    },
  ],
  skills: [],
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

      expect(getMonsterFoundAtNodes(goblin.id)).toEqual(['Field Ruins', 'Swamp']);
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
      vi.mocked(getEntriesByType).mockImplementation((type) =>
        (type === 'encounter' ? [fieldRuinsEncounter, swampEncounter] : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual(['Field Ruins']);
    });

    it('includes encounter-random nodes whose creature pool has the monster', () => {
      vi.mocked(getEntriesByType).mockImplementation((type) =>
        (type === 'encounterrandom' ? [wildsEncounterRandom] : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual(['The Wilds']);
    });

    it('returns an empty array when the monster appears nowhere', () => {
      vi.mocked(getEntriesByType).mockImplementation((type) =>
        (type === 'encounter' ? [swampEncounter] : []) as never,
      );

      expect(monsterSourceNodeNames(goblin.id)).toEqual([]);
    });
  });

  describe('bestiaryDropQuantityLabel', () => {
    it('shows the raw range when bonusPerLevel is absent, regardless of level', () => {
      const reward = { itemId: 'gold-coin' as ItemId, min: 3, max: 10, chance: 100 };

      expect(bestiaryDropQuantityLabel(reward, 1)).toBe('3-10');
      expect(bestiaryDropQuantityLabel(reward, 10)).toBe('3-10');
    });

    it('scales the range up by level * bonusPerLevel', () => {
      expect(
        bestiaryDropQuantityLabel(
          {
            itemId: 'gold-coin' as ItemId,
            min: 3,
            max: 10,
            bonusPerLevel: 2,
            chance: 100,
          },
          4,
        ),
      ).toBe('11-18');
    });

    it('collapses to a single number when min equals max', () => {
      expect(
        bestiaryDropQuantityLabel(
          { itemId: 'gold-coin' as ItemId, min: 5, max: 5, chance: 100 },
          1,
        ),
      ).toBe('5');
    });

    it('shows 1 for a flat-chance equipment/collectible/recipe drop regardless of level', () => {
      expect(
        bestiaryDropQuantityLabel({ equipmentId: 'sword' as never, chance: 10 }, 5),
      ).toBe('1');
    });
  });

  describe('bestiaryXpLabel', () => {
    it('shows the raw range when bonusPerLevel is absent, regardless of level', () => {
      const flatXpMonster: MonsterContent = { ...goblin, xp: { min: 3, max: 5 } };

      expect(bestiaryXpLabel(flatXpMonster, 1)).toBe('3-5');
      expect(bestiaryXpLabel(flatXpMonster, 10)).toBe('3-5');
    });

    it('scales the range up by level * bonusPerLevel', () => {
      // xp.bonusPerLevel is 1 on the shared goblin fixture.
      expect(bestiaryXpLabel(goblin, 3)).toBe('6-8');
    });

    it('collapses to a single number when min equals max', () => {
      const flatXpMonster: MonsterContent = {
        ...goblin,
        xp: { min: 10, max: 10 },
      };

      expect(bestiaryXpLabel(flatXpMonster, 1)).toBe('10');
    });
  });

  describe('getBestiaryEntries', () => {
    it('builds an entry for every monster, discovered or not', () => {
      vi.mocked(getEntriesByType).mockImplementation((type) => {
        if (type === 'monster') return [goblin] as never;
        if (type === 'encounter') return [fieldRuinsEncounter] as never;
        return [] as never;
      });
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {},
      } as unknown as GameState);
      vi.mocked(isRewardDiscovered).mockReturnValue(false);

      const entries = getBestiaryEntries();

      expect(entries).toEqual([
        {
          monster: goblin,
          discovered: false,
          kills: 0,
          levelRange: undefined,
          foundAtNodes: [],
          sourceNodeNames: ['Field Ruins'],
          drops: [{ reward: goblin.drops[0], discovered: false }],
        },
      ]);
    });

    it('uses the actual found level range and locations for a discovered monster', () => {
      vi.mocked(getEntriesByType).mockImplementation((type) => {
        if (type === 'monster') return [goblin] as never;
        return [] as never;
      });
      vi.mocked(gamestate).mockReturnValue({
        bestiary: {
          [goblin.id]: {
            foundAt: 1000,
            kills: 5,
            minLevelFound: 2,
            maxLevelFound: 6,
            foundAtNodes: ['Field Ruins', 'Swamp'],
          },
        },
      } as unknown as GameState);
      vi.mocked(isRewardDiscovered).mockReturnValue(true);

      const entries = getBestiaryEntries();

      expect(entries[0]).toEqual(
        expect.objectContaining({
          discovered: true,
          kills: 5,
          levelRange: { min: 2, max: 6 },
          foundAtNodes: ['Field Ruins', 'Swamp'],
        }),
      );
    });
  });

  describe('filterBestiaryEntries', () => {
    const discoveredEntry: BestiaryEntry = {
      monster: goblin,
      discovered: true,
      kills: 3,
      levelRange: { min: 1, max: 5 },
      foundAtNodes: ['Field Ruins'],
      sourceNodeNames: ['Field Ruins'],
      drops: [{ reward: goblin.drops[0], discovered: true }],
    };

    const undiscoveredEntry: BestiaryEntry = {
      monster: { ...goblin, id: 'wolf' as MonsterId, name: 'Wolf' },
      discovered: false,
      kills: 0,
      foundAtNodes: [],
      sourceNodeNames: ['The Wilds'],
      drops: [],
    };

    const entries = [discoveredEntry, undiscoveredEntry];

    it('returns every entry when the search text is empty', () => {
      expect(filterBestiaryEntries(entries, '   ')).toEqual(entries);
    });

    it('matches a discovered entry by monster name', () => {
      expect(filterBestiaryEntries(entries, 'goblin')).toEqual([discoveredEntry]);
    });

    it('matches a discovered entry by a place it was found', () => {
      expect(filterBestiaryEntries(entries, 'field ruins')).toEqual([
        discoveredEntry,
      ]);
    });

    it('matches a discovered entry by a discovered drop name', () => {
      vi.mocked(rewardContentInfo).mockReturnValue({
        name: 'Gold Coin',
        sprite: '0000',
        spritesheet: 'item',
      });

      expect(filterBestiaryEntries([discoveredEntry], 'gold coin')).toEqual([
        discoveredEntry,
      ]);
    });

    it('never matches an undiscovered entry, even by its source node name', () => {
      expect(filterBestiaryEntries(entries, 'wilds')).toEqual([]);
    });

    it('does not match an undiscovered entry by its real monster name', () => {
      expect(filterBestiaryEntries(entries, 'wolf')).toEqual([]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterBestiaryEntries(entries, 'nonexistent')).toEqual([]);
    });
  });
});
