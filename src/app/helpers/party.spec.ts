import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  IsContentItem,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${mockUuidCounter++}`),
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
  characterStatsForLevel,
  characterXpForLevel,
  createCharacter,
  isPartyAtFullHealth,
  partyGet,
  pruneInvalidPartyEquipment,
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
    equippableTypes: ['Cloth Armor', 'Hat', 'Sword', 'Spear', 'Shield'],
    statPriority: [],
    skillPath: [],
  };

  const mockCloak: EquipmentContent = {
    id: 'equip-cloak' as EquipmentId,
    name: 'Cloak of Adventuring',
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: { ...defaultStats(), Agility: 0.2, Resistance: 0.2 },
    statsPerLevel: defaultStats(),
    type: 'Cloth Armor',
    slots: 1,
  };

  const mockHelmet: EquipmentContent = {
    ...mockCloak,
    id: 'equip-helmet' as EquipmentId,
    name: 'Helmet',
    baseStats: { ...defaultStats(), Vitality: 3 },
    type: 'Hat',
  };

  const mockStarterHat: EquipmentContent = {
    ...mockCloak,
    id: 'equip-hat-of-adventuring' as EquipmentId,
    name: 'Hat of Adventuring',
    baseStats: defaultStats(),
    type: 'Hat',
  };

  // Resolves the starter cloak/hat plus any passed-in items, matching by id or name like the real implementation.
  function mockGetEntry(...entries: IsContentItem[]): void {
    const known = [mockCloak, mockStarterHat, ...entries];
    vi.mocked(getEntry).mockImplementation(
      (idOrName) =>
        known.find(
          (entry) => entry.id === idOrName || entry.name === idOrName,
        ) as never,
    );
  }

  beforeEach(() => {
    mockUuidCounter = 0;
    vi.clearAllMocks();
  });

  describe('createCharacter', () => {
    it('should build a level 1 character using the job baseStats plus starter equipment', () => {
      mockGetEntry(mockJob);

      const character = createCharacter('Jala', 'job-explorer' as JobId);

      expect(character.id).toBeTruthy();
      expect(character.name).toBe('Jala');
      expect(character.level).toBe(1);
      expect(character.xp).toEqual({ current: 0, maximum: 100 });
      expect(character.jobId).toBe('job-explorer');
      expect(character.stats).toEqual(
        characterStatsForLevel('job-explorer' as JobId, 1, character.equipment),
      );
      expect(character.traitIds).toEqual([]);
    });

    it('should equip a Cloak of Adventuring and Hat of Adventuring by default', () => {
      mockGetEntry(mockJob);

      const character = createCharacter('Jala', 'job-explorer' as JobId);

      expect(character.equipment.Armor).toEqual({
        id: expect.any(String),
        equipmentId: mockCloak.id,
        infusedItemIds: [],
      });
      expect(character.equipment.Helmet).toEqual({
        id: expect.any(String),
        equipmentId: mockStarterHat.id,
        infusedItemIds: [],
      });
      expect(
        Object.entries(character.equipment)
          .filter(([slot]) => slot !== 'Armor' && slot !== 'Helmet')
          .every(([, item]) => item === undefined),
      ).toBe(true);
    });

    it('should fall back to default (zeroed) job stats when the job cannot be found', () => {
      mockGetEntry();

      const character = createCharacter('Spoorle', 'unknown-job' as JobId);

      expect(character.stats).toEqual({
        ...defaultStats(),
        Agility: mockCloak.baseStats.Agility,
        Resistance: mockCloak.baseStats.Resistance,
      });
    });
  });

  describe('setParty', () => {
    it('should update the gamestate world.party with the given party', () => {
      mockGetEntry(mockJob);
      const party: Character[] = [
        createCharacterStub('Jala'),
        createCharacterStub('Spoorle'),
      ];

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
      mockGetEntry(mockJob);
      const party: Character[] = [createCharacterStub('Jala')];
      vi.mocked(gamestate).mockReturnValue({
        world: { party },
      } as unknown as GameState);

      expect(partyGet()).toBe(party);
    });
  });

  describe('isPartyAtFullHealth', () => {
    function fullHealthCharacter(overrides: Partial<Character> = {}): Character {
      mockGetEntry(mockJob);
      return {
        ...createCharacterStub('Jala'),
        hp: 100,
        stats: { ...defaultStats(), Health: 100 },
        ...overrides,
      };
    }

    it('is true when every hero is at or above their max HP', () => {
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [fullHealthCharacter(), fullHealthCharacter()] },
      } as unknown as GameState);

      expect(isPartyAtFullHealth()).toBe(true);
    });

    it('is false when any hero is below their max HP', () => {
      vi.mocked(gamestate).mockReturnValue({
        world: {
          party: [
            fullHealthCharacter(),
            fullHealthCharacter({ hp: 50 }),
          ],
        },
      } as unknown as GameState);

      expect(isPartyAtFullHealth()).toBe(false);
    });

    it('is true for an empty party', () => {
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [] },
      } as unknown as GameState);

      expect(isPartyAtFullHealth()).toBe(true);
    });
  });

  describe('pruneInvalidPartyEquipment', () => {
    it('leaves equipment untouched when everything still resolves to real content', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');

      const [pruned] = pruneInvalidPartyEquipment([jala]);

      expect(pruned.equipment).toEqual(jala.equipment);
      expect(pruned.stats).toEqual(jala.stats);
    });

    it('clears slots whose equipmentId no longer resolves to real content', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      const withStaleGear: Character = {
        ...jala,
        equipment: {
          ...jala.equipment,
          Helmet: mockEquipmentItem('stale-helmet' as EquipmentId),
        },
      };

      const [pruned] = pruneInvalidPartyEquipment([withStaleGear]);

      expect(pruned.equipment.Helmet).toBeUndefined();
      expect(pruned.equipment.Armor).toEqual(withStaleGear.equipment.Armor);
      expect(pruned.stats).toEqual(
        characterStatsForLevel(
          'job-explorer' as JobId,
          withStaleGear.level,
          pruned.equipment,
        ),
      );
    });

    it('clamps current hp/ep down when pruning lowers max Health/Energy', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      const equippedJala: Character = {
        ...jala,
        equipment: { ...jala.equipment, Ring: mockEquipmentItem(mockHelmet.id) },
      };
      const statsWithHelmet = characterStatsForLevel(
        'job-explorer' as JobId,
        equippedJala.level,
        equippedJala.equipment,
      );
      const overHealedJala: Character = {
        ...equippedJala,
        stats: statsWithHelmet,
        hp: statsWithHelmet.Health,
      };

      // simulate the helmet's content being removed from gamedata
      mockGetEntry(mockJob);

      const [pruned] = pruneInvalidPartyEquipment([overHealedJala]);

      expect(pruned.equipment.Ring).toBeUndefined();
      expect(pruned.hp).toBe(pruned.stats.Health);
    });

    it('processes every party member independently', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
        equipment: {
          ...createCharacterStub('Spoorle').equipment,
          Helmet: mockEquipmentItem('stale-helmet' as EquipmentId),
        },
      };

      const [prunedJala, prunedSpoorle] = pruneInvalidPartyEquipment([
        jala,
        spoorle,
      ]);

      expect(prunedJala.equipment).toEqual(jala.equipment);
      expect(prunedSpoorle.equipment.Helmet).toBeUndefined();
    });
  });

  describe('characterXpForLevel', () => {
    it('requires 100 xp to reach level 2 from level 1', () => {
      expect(characterXpForLevel(1)).toBe(100);
    });

    it('reaches 1000x the starting requirement at the level cap', () => {
      expect(characterXpForLevel(CHARACTER_MAX_LEVEL)).toBe(100_000);
    });

    it('eases in gradually rather than jumping hard on the early levels', () => {
      expect(characterXpForLevel(2)).toBe(200);
      expect(characterXpForLevel(10)).toBeGreaterThan(characterXpForLevel(2));
    });

    it('rounds every value to the nearest 10', () => {
      for (let level = 1; level <= CHARACTER_MAX_LEVEL; level += 1) {
        expect(characterXpForLevel(level) % 10).toBe(0);
      }
    });

    it('grows by a larger amount per level as level increases (ease-in curve)', () => {
      const earlyGap = characterXpForLevel(10) - characterXpForLevel(9);
      const lateGap = characterXpForLevel(90) - characterXpForLevel(89);
      expect(lateGap).toBeGreaterThan(earlyGap);
    });
  });

  describe('characterStatsForLevel', () => {
    it('returns the job baseStats at level 1 with no equipment', () => {
      mockGetEntry(mockJob);

      const stats = characterStatsForLevel(
        'job-explorer' as JobId,
        1,
        defaultEquipment(),
      );

      expect(stats).toEqual(mockJob.baseStats);
    });

    it('applies job statsPerLevel scaling for higher levels', () => {
      mockGetEntry(mockJob);

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

    it('adds flat equipment baseStats on top', () => {
      const sword: EquipmentContent = {
        id: 'sword' as EquipmentId,
        name: 'Sword',
        __type: 'equipment',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        levelRequirement: 1,
        baseStats: { ...defaultStats(), Strength: 5 },
        type: 'Sword',
        slots: 1,
      };

      mockGetEntry(mockJob, sword);

      const equipment: EquipmentBlock = {
        ...defaultEquipment(),
        Weapon: mockEquipmentItem('sword' as EquipmentId),
      };

      const stats = characterStatsForLevel('job-explorer' as JobId, 5, equipment);

      expect(stats.Strength).toBe(
        mockJob.baseStats.Strength + mockJob.statsPerLevel.Strength * 4 + 5,
      );
    });
  });

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }

  let fixtureItemCounter = 0;

  // Uses its own counter (not the mocked uuid) so fixtures are independent of how many rngUuid calls the code under test makes.
  function mockEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
    return {
      id: `fixture-item-${fixtureItemCounter++}` as EquipmentItemId,
      equipmentId,
      infusedItemIds: [],
    };
  }
});
