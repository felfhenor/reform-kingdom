import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  GameState,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  CHARACTER_MAX_LEVEL,
  characterReclass,
  characterStatsForLevel,
  characterXpForLevel,
  createCharacter,
  healingTicksForLevel,
  partyGainXp,
  partyGet,
  setParty,
} from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Party Helper Functions', () => {
  const mockJob: JobContent = {
    id: 'job-explorer' as JobId,
    name: 'Explorer',
    __type: 'job',
    description: 'A person who seeks out new lands and experiences.',
    sprite: '0000',
    frames: 4,
    baseStats: {
      Health: 100,
      Energy: 25,
      Luck: 5,
      Intelligence: 5,
      Strength: 5,
      Vitality: 5,
      Resistance: 5,
      Agility: 10,
    },
    statsPerLevel: {
      Health: 10,
      Energy: 5,
      Luck: 0.01,
      Intelligence: 0.2,
      Strength: 0.5,
      Vitality: 0.3,
      Resistance: 0.4,
      Agility: 0.7,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCharacter', () => {
    it('should build a level 1 character using the job baseStats', () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);

      const character = createCharacter('Jala', 'job-explorer' as JobId);

      expect(character.id).toBe('mock-uuid');
      expect(character.name).toBe('Jala');
      expect(character.level).toBe(1);
      expect(character.xp).toEqual({ current: 0, maximum: 100 });
      expect(character.jobId).toBe('job-explorer');
      expect(character.stats).toEqual(mockJob.baseStats);
      expect(character.traitIds).toEqual([]);
    });

    it('should give the character an empty equipment block', () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);

      const character = createCharacter('Jala', 'job-explorer' as JobId);

      expect(Object.values(character.equipment).every((v) => v === undefined)).toBe(
        true,
      );
    });

    it('should fall back to default (zeroed) stats when the job cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      const character = createCharacter('Spoorle', 'unknown-job' as JobId);

      expect(character.stats).toEqual({
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      });
    });
  });

  describe('setParty', () => {
    it('should update the gamestate world.party with the given party', () => {
      const party: Character[] = [
        createCharacterStub('Jala'),
        createCharacterStub('Spoorle'),
      ];
      vi.mocked(getEntry).mockReturnValue(mockJob);

      setParty(party);

      expect(updateGamestate).toHaveBeenCalledTimes(1);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const fakeState = {
        world: { party: [] },
      } as unknown as GameState;

      const result = updateFn(fakeState);

      expect(result.world.party).toEqual(party);
    });
  });

  describe('partyGet', () => {
    it('should return the party from state', () => {
      const party: Character[] = [createCharacterStub('Jala')];
      vi.mocked(getEntry).mockReturnValue(mockJob);
      vi.mocked(gamestate).mockReturnValue({
        world: { party },
      } as unknown as GameState);

      expect(partyGet()).toBe(party);
    });
  });

  describe('characterReclass', () => {
    const warriorJob: JobContent = {
      ...mockJob,
      id: 'job-warrior' as JobId,
      name: 'Warrior',
      baseStats: { ...mockJob.baseStats, Health: 150, Strength: 15 },
    };

    it("should update the character's jobId, recompute stats from the new job, and reset level/xp", () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      jala.xp.current = 50;

      vi.mocked(getEntry).mockReturnValueOnce(warriorJob);
      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].jobId).toBe('job-warrior');
      expect(result.world.party[0].stats).toEqual(warriorJob.baseStats);
      expect(result.world.party[0].hp).toBe(warriorJob.baseStats.Health);
      expect(result.world.party[0].level).toBe(1);
      expect(result.world.party[0].xp).toEqual({ current: 0, maximum: 100 });
    });

    it('should leave other party members untouched', () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);
      const jala = createCharacterStub('Jala');
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
      };

      vi.mocked(getEntry).mockReturnValueOnce(warriorJob);
      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala, spoorle] },
      } as unknown as GameState);

      expect(result.world.party[1]).toEqual(spoorle);
    });
  });

  describe('healingTicksForLevel', () => {
    it('returns a 10 second minimum plus twice the highest member level', () => {
      expect(
        healingTicksForLevel([{ level: 3 }, { level: 7 }, { level: 2 }]),
      ).toBe(24);
    });

    it('defaults to a minimum level of 1 for an empty party', () => {
      expect(healingTicksForLevel([])).toBe(12);
    });
  });

  describe('characterXpForLevel', () => {
    it('requires 100 xp to reach level 2 from level 1', () => {
      expect(characterXpForLevel(1)).toBe(100);
    });

    it('scales up for higher levels', () => {
      expect(characterXpForLevel(2)).toBe(283);
      expect(characterXpForLevel(10)).toBeGreaterThan(characterXpForLevel(2));
    });
  });

  describe('characterStatsForLevel', () => {
    it('returns the job baseStats at level 1 with no equipment', () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);

      const stats = characterStatsForLevel(
        'job-explorer' as JobId,
        1,
        defaultEquipment(),
      );

      expect(stats).toEqual(mockJob.baseStats);
    });

    it('applies job statsPerLevel scaling for higher levels', () => {
      vi.mocked(getEntry).mockReturnValue(mockJob);

      const stats = characterStatsForLevel(
        'job-explorer' as JobId,
        3,
        defaultEquipment(),
      );

      expect(stats.Health).toBe(
        mockJob.baseStats.Health + mockJob.statsPerLevel.Health * 2,
      );
      expect(stats.Strength).toBeCloseTo(
        mockJob.baseStats.Strength + mockJob.statsPerLevel.Strength * 2,
      );
    });

    it('adds flat equipment baseStats on top, ignoring equipment statsPerLevel', () => {
      const sword: EquipmentContent = {
        id: 'sword' as EquipmentId,
        name: 'Sword',
        __type: 'equipment',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        levelRequirement: 1,
        baseStats: { ...defaultStats(), Strength: 5 },
        statsPerLevel: { ...defaultStats(), Strength: 100 },
        slots: ['Weapon'],
      };

      vi.mocked(getEntry).mockImplementation((id) =>
        (id === 'job-explorer' ? mockJob : sword) as never,
      );

      const equipment: EquipmentBlock = {
        ...defaultEquipment(),
        Weapon: { equipmentId: 'sword' as EquipmentId },
      };

      const stats = characterStatsForLevel('job-explorer' as JobId, 5, equipment);

      expect(stats.Strength).toBe(
        mockJob.baseStats.Strength + mockJob.statsPerLevel.Strength * 4 + 5,
      );
    });
  });

  describe('partyGainXp', () => {
    beforeEach(() => {
      vi.mocked(getEntry).mockReturnValue(mockJob);
    });

    it('adds xp without leveling up when below the threshold', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].xp).toEqual({ current: 30, maximum: 100 });
      expect(result.world.party[0].level).toBe(1);
      expect(result.world.party[0].stats).toEqual(jala.stats);
    });

    it('levels up and recalculates stats when xp meets the threshold', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(2);
      expect(result.world.party[0].xp).toEqual({
        current: 0,
        maximum: characterXpForLevel(2),
      });
      expect(result.world.party[0].stats).toEqual(
        characterStatsForLevel('job-explorer' as JobId, 2, jala.equipment),
      );
    });

    it('carries over remainder xp and can grant multiple levels from one large gain', () => {
      const jala = createCharacterStub('Jala');
      const totalXp = characterXpForLevel(1) + characterXpForLevel(2) + 15;

      partyGainXp(totalXp);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(3);
      expect(result.world.party[0].xp.current).toBe(15);
      expect(result.world.party[0].xp.maximum).toBe(characterXpForLevel(3));
    });

    it('stops leveling at the max level and clamps xp to the final threshold', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: CHARACTER_MAX_LEVEL,
        xp: { current: 0, maximum: characterXpForLevel(CHARACTER_MAX_LEVEL) },
      };

      partyGainXp(999999);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(CHARACTER_MAX_LEVEL);
      expect(result.world.party[0].xp.current).toBe(
        result.world.party[0].xp.maximum,
      );
    });
  });

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }
});
