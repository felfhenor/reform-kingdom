import type {
  Character,
  CharacterId,
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
import { characterReclass, createCharacter, partyGet, setParty } from '@helpers/party';
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

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }
});
