import type {
  Character,
  CharacterId,
  Combatant,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSkillContent,
  EquipmentSkillId,
  GameState,
  IsContentItem,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A unique id per call (not a constant) - equipped-item dedup is now keyed
// by instance id, so two distinct equipped items in the same test must not
// collide on the same mocked uuid the way a constant mock would cause.
let mockUuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${mockUuidCounter++}`),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/combat-log', () => ({
  miscellaneousMessageLog: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { currentCombat } from '@helpers/combat';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  CHARACTER_MAX_LEVEL,
  characterEquipFromArmory,
  characterEquipItem,
  characterReclass,
  characterStatsForLevel,
  characterUnequipItem,
  characterUnequipToArmory,
  characterXpForLevel,
  createCharacter,
  healingTicksForLevel,
  healPartyToFull,
  partyGainXp,
  partyGet,
  pruneInvalidPartyEquipment,
  retrofitPartyXp,
  setParty,
  syncPartyHpFromCombat,
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

  // Mocks getEntry() so it resolves the starter cloak/hat plus any content
  // items passed in, matching by either id or name like the real
  // implementation.
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
    vi.mocked(currentCombat).mockReturnValue(undefined);
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

  describe('characterReclass', () => {
    const warriorJob: JobContent = {
      ...mockJob,
      id: 'job-warrior' as JobId,
      name: 'Warrior',
      baseStats: { ...mockJob.baseStats, Health: 150, Strength: 15 },
    };

    it("should update the character's jobId, recompute stats from the new job, and reset level/xp", () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      jala.xp.current = 50;

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      const expectedStats = characterStatsForLevel(
        'job-warrior' as JobId,
        1,
        defaultEquipment(),
      );

      expect(result.world.party[0].jobId).toBe('job-warrior');
      expect(result.world.party[0].stats).toEqual(expectedStats);
      expect(result.world.party[0].hp).toBe(expectedStats.Health);
      expect(result.world.party[0].ep).toBe(expectedStats.Energy);
      expect(result.world.party[0].level).toBe(1);
      expect(result.world.party[0].xp).toEqual({ current: 0, maximum: 100 });
    });

    it('unequips all gear on the character', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');
      expect(jala.equipment.Armor).toBeDefined();

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      expect(result.world.party[0].equipment).toEqual(defaultEquipment());
    });

    it('sends previously equipped gear to the armory instead of discarding it', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      expect(result.armory).toEqual([
        jala.equipment.Armor,
        jala.equipment.Helmet,
      ]);
    });

    it('appends to any gear already in the armory', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');
      const existingItem = { equipmentId: 'equip-existing' as EquipmentId };

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [existingItem],
      } as unknown as GameState);

      expect(result.armory).toEqual([
        existingItem,
        jala.equipment.Armor,
        jala.equipment.Helmet,
      ]);
    });

    it('saves the outgoing job level/xp on jobProgress before switching', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      jala.xp.current = 50;

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      expect(result.world.party[0].jobProgress['job-explorer' as JobId]).toEqual(
        { level: 10, xp: { current: 50, maximum: jala.xp.maximum } },
      );
    });

    it('restores previously saved level/xp when reclassing back to a held job', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      jala.xp.current = 50;

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn1 = vi.mocked(updateGamestate).mock.calls[0][0];
      const afterFirstReclass = updateFn1({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState).world.party[0];

      vi.clearAllMocks();
      mockGetEntry(mockJob, warriorJob);
      characterReclass(afterFirstReclass.id, 'job-explorer' as JobId);

      const updateFn2 = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn2({
        world: { party: [afterFirstReclass] },
        armory: [],
      } as unknown as GameState);

      expect(result.world.party[0].level).toBe(10);
      expect(result.world.party[0].xp).toEqual({
        current: 50,
        maximum: jala.xp.maximum,
      });
      expect(
        result.world.party[0].jobProgress['job-explorer' as JobId],
      ).toBeUndefined();
      expect(
        result.world.party[0].jobProgress['job-warrior' as JobId],
      ).toEqual({ level: 1, xp: { current: 0, maximum: 100 } });
    });

    it('should leave other party members untouched', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
      };

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala, spoorle] },
        armory: [],
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

  describe('retrofitPartyXp', () => {
    it("rescales a character's xp.maximum to the current curve for their level", () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: 2,
        xp: { current: 50, maximum: 283 },
      };

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.xp).toEqual({
        current: 50,
        maximum: characterXpForLevel(2),
      });
    });

    it('clamps current xp down without leveling up when it now exceeds the new maximum', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        level: 2,
        xp: { current: 283, maximum: 283 },
      };

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.level).toBe(2);
      expect(retrofitted.xp).toEqual({
        current: characterXpForLevel(2),
        maximum: characterXpForLevel(2),
      });
    });

    it('rescales jobProgress entries for held-but-inactive jobs using their own level', () => {
      const jala = {
        ...createCharacterStub('Jala'),
        jobProgress: {
          'job-warrior': { level: 5, xp: { current: 999999, maximum: 999999 } },
        },
      } as unknown as Character;

      const [retrofitted] = retrofitPartyXp([jala]);

      expect(retrofitted.jobProgress['job-warrior' as JobId]).toEqual({
        level: 5,
        xp: {
          current: characterXpForLevel(5),
          maximum: characterXpForLevel(5),
        },
      });
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

  describe('characterEquipItem', () => {
    it('equips the item into the given slot and recalculates stats', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');

      const result = characterEquipItem(jala.id, 'Helmet', mockHelmet.id);

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      const updated = state.world.party[0];
      expect(updated.equipment.Helmet).toEqual({
        id: expect.any(String),
        equipmentId: mockHelmet.id,
        infusedItemIds: [],
      });
      expect(updated.equipment.Armor).toEqual(jala.equipment.Armor);
      expect(updated.stats).toEqual(
        characterStatsForLevel('job-explorer' as JobId, 1, updated.equipment),
      );
    });

    it('leaves other party members and slots untouched', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
      };

      characterEquipItem(jala.id, 'Helmet', mockHelmet.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala, spoorle] },
      } as unknown as GameState);

      expect(state.world.party[1]).toEqual(spoorle);
    });

    it('clamps current hp down if the new equipment lowers max Health', () => {
      const cursedHelmet: EquipmentContent = {
        ...mockHelmet,
        id: 'equip-cursed' as EquipmentId,
        name: 'Cursed Helmet',
        baseStats: { ...defaultStats(), Health: -20 },
      };
      mockGetEntry(mockJob, cursedHelmet);
      const jala = { ...createCharacterStub('Jala'), hp: mockJob.baseStats.Health };

      characterEquipItem(jala.id, 'Helmet', cursedHelmet.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      const updated = state.world.party[0];
      expect(updated.stats.Health).toBe(mockJob.baseStats.Health - 20);
      expect(updated.hp).toBe(updated.stats.Health);
    });

    it('clamps current ep down if the new equipment lowers max Energy', () => {
      const cursedHelmet: EquipmentContent = {
        ...mockHelmet,
        id: 'equip-cursed' as EquipmentId,
        name: 'Cursed Helmet',
        baseStats: { ...defaultStats(), Energy: -20 },
      };
      mockGetEntry(mockJob, cursedHelmet);
      const jala = { ...createCharacterStub('Jala'), ep: mockJob.baseStats.Energy };

      characterEquipItem(jala.id, 'Helmet', cursedHelmet.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      const updated = state.world.party[0];
      expect(updated.stats.Energy).toBe(mockJob.baseStats.Energy - 20);
      expect(updated.ep).toBe(updated.stats.Energy);
    });

    it('does nothing and returns false while the party is in combat', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      vi.mocked(currentCombat).mockReturnValue({} as never);

      const result = characterEquipItem(jala.id, 'Helmet', mockHelmet.id);

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });

  describe('characterUnequipItem', () => {
    it('clears the slot and recalculates stats', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');

      const result = characterUnequipItem(jala.id, 'Armor');

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      const updated = state.world.party[0];
      expect(updated.equipment.Armor).toBeUndefined();
      expect(updated.stats).toEqual(
        characterStatsForLevel('job-explorer' as JobId, 1, updated.equipment),
      );
    });

    it('does nothing and returns false while the party is in combat', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      vi.mocked(currentCombat).mockReturnValue({} as never);

      const result = characterUnequipItem(jala.id, 'Armor');

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });

  describe('characterEquipFromArmory', () => {
    const mockSpear: EquipmentContent = {
      ...mockCloak,
      id: 'equip-spear' as EquipmentId,
      name: 'Copper Spear',
      type: 'Spear',
    };

    it('equips an armory item into its slot and removes it from the armory', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      const armoryHelmet = mockEquipmentItem(mockHelmet.id);
      const fakeState = {
        world: { party: [jala] },
        armory: [armoryHelmet],
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(fakeState);

      const result = characterEquipFromArmory(jala.id, armoryHelmet.id);

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn(fakeState);

      expect(state.world.party[0].equipment.Helmet).toEqual(armoryHelmet);
      expect(state.armory).toEqual([jala.equipment.Helmet]);
    });

    it('returns the previously equipped item in that slot back to the armory', () => {
      mockGetEntry(mockJob, mockCloak, mockHelmet);
      const jala = createCharacterStub('Jala');
      const oldHelmet = mockEquipmentItem('old-helmet' as EquipmentId);
      const equippedJala: Character = {
        ...jala,
        equipment: { ...jala.equipment, Helmet: oldHelmet },
      };
      const armoryHelmet = mockEquipmentItem(mockHelmet.id);
      const fakeState = {
        world: { party: [equippedJala] },
        armory: [armoryHelmet],
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(fakeState);

      characterEquipFromArmory(equippedJala.id, armoryHelmet.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn(fakeState);

      expect(state.world.party[0].equipment.Helmet).toEqual(armoryHelmet);
      expect(state.armory).toEqual([oldHelmet]);
    });

    it('returns false without mutating state while the party is in combat', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      vi.mocked(currentCombat).mockReturnValue({} as never);

      const result = characterEquipFromArmory(
        jala.id,
        'irrelevant' as EquipmentItemId,
      );

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false without mutating state when the hero is under-level for the item', () => {
      const highLevelHelmet: EquipmentContent = {
        ...mockHelmet,
        levelRequirement: 99,
      };
      mockGetEntry(mockJob, highLevelHelmet);
      const jala = createCharacterStub('Jala');
      const armoryItem = mockEquipmentItem(highLevelHelmet.id);
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [armoryItem],
      } as unknown as GameState);

      const result = characterEquipFromArmory(jala.id, armoryItem.id);

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false without mutating state when the item is not in the armory', () => {
      mockGetEntry(mockJob, mockHelmet);
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      const result = characterEquipFromArmory(
        jala.id,
        'missing-instance' as EquipmentItemId,
      );

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('equips a two-handed item into every slot it declares at once', () => {
      mockGetEntry(mockJob, mockCloak, mockSpear);
      const jala = createCharacterStub('Jala');
      const armorySpear = mockEquipmentItem(mockSpear.id);
      const fakeState = {
        world: { party: [jala] },
        armory: [armorySpear],
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(fakeState);

      const result = characterEquipFromArmory(jala.id, armorySpear.id);

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn(fakeState);

      expect(state.world.party[0].equipment.Weapon).toEqual(armorySpear);
      expect(state.world.party[0].equipment.Offhand).toEqual(armorySpear);
    });

    it('only counts a two-handed item once toward stat totals', () => {
      const spearWithStats: EquipmentContent = {
        ...mockSpear,
        baseStats: { ...defaultStats(), Strength: 3 },
      };
      mockGetEntry(mockJob, mockCloak, spearWithStats);
      const jala = createCharacterStub('Jala');
      const armorySpear = mockEquipmentItem(spearWithStats.id);
      const fakeState = {
        world: { party: [jala] },
        armory: [armorySpear],
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(fakeState);

      characterEquipFromArmory(jala.id, armorySpear.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn(fakeState);

      expect(state.world.party[0].stats.Strength).toBe(
        mockJob.baseStats.Strength + spearWithStats.baseStats.Strength,
      );
    });

    it('fully displaces a two-handed item back to the armory (once) when a single-slot item overwrites one of its hands', () => {
      const mockOffhandItem: EquipmentContent = {
        ...mockCloak,
        id: 'equip-shield' as EquipmentId,
        name: 'Shield',
        type: 'Shield',
      };
      mockGetEntry(mockJob, mockCloak, mockSpear, mockOffhandItem);
      const jala = createCharacterStub('Jala');
      const equippedSpear = mockEquipmentItem(mockSpear.id);
      const spearEquippedJala: Character = {
        ...jala,
        equipment: {
          ...jala.equipment,
          Weapon: equippedSpear,
          Offhand: equippedSpear,
        },
      };
      const armoryOffhandItem = mockEquipmentItem(mockOffhandItem.id);
      const fakeState = {
        world: { party: [spearEquippedJala] },
        armory: [armoryOffhandItem],
      } as unknown as GameState;
      vi.mocked(gamestate).mockReturnValue(fakeState);

      characterEquipFromArmory(spearEquippedJala.id, armoryOffhandItem.id);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn(fakeState);

      expect(state.world.party[0].equipment.Offhand).toEqual(armoryOffhandItem);
      expect(state.world.party[0].equipment.Weapon).toBeUndefined();
      expect(state.armory).toEqual([equippedSpear]);
    });
  });

  describe('characterUnequipToArmory', () => {
    it('moves the equipped item to the armory and clears the slot', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      const result = characterUnequipToArmory(jala.id, 'Armor');

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      expect(state.world.party[0].equipment.Armor).toBeUndefined();
      expect(state.armory).toEqual([jala.equipment.Armor]);
    });

    it('returns false without mutating state when the slot is already empty', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      const result = characterUnequipToArmory(jala.id, 'Weapon');

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('returns false without mutating state while the party is in combat', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);
      vi.mocked(currentCombat).mockReturnValue({} as never);

      const result = characterUnequipToArmory(jala.id, 'Armor');

      expect(result).toBe(false);
      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('clears every slot a two-handed item occupies and returns it to the armory once', () => {
      mockGetEntry(mockJob);
      const jala = createCharacterStub('Jala');
      const spearId = 'equip-spear' as EquipmentId;
      const spearItem = mockEquipmentItem(spearId);
      const spearEquippedJala: Character = {
        ...jala,
        equipment: {
          ...jala.equipment,
          Weapon: spearItem,
          Offhand: spearItem,
        },
      };
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [spearEquippedJala] },
        armory: [],
      } as unknown as GameState);

      const result = characterUnequipToArmory(spearEquippedJala.id, 'Weapon');

      expect(result).toBe(true);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [spearEquippedJala] },
        armory: [],
      } as unknown as GameState);

      expect(state.world.party[0].equipment.Weapon).toBeUndefined();
      expect(state.world.party[0].equipment.Offhand).toBeUndefined();
      expect(state.armory).toEqual([spearItem]);
    });
  });

  describe('partyGainXp', () => {
    beforeEach(() => {
      mockGetEntry(mockJob);
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

    it('does not log anything when the character does not level up', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).not.toHaveBeenCalled();
    });

    it('logs a level-up message when the character levels up', () => {
      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** reached level 2!',
      );
    });

    it('logs a message for each newly learned skill on level-up', () => {
      const attackSkill: EquipmentSkillContent = {
        id: 'skill-attack' as EquipmentSkillId,
        name: 'Attack',
        __type: 'skill',
      } as EquipmentSkillContent;

      const jobWithSkills: JobContent = {
        ...mockJob,
        skillPath: [
          {
            pathName: 'Attack',
            levels: [{ level: 2, skillId: attackSkill.id }],
          },
        ],
      };

      mockGetEntry(jobWithSkills, attackSkill);

      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** learned **Attack**!',
      );
    });

    it('does not log a skill when the job cannot be found', () => {
      mockGetEntry();

      const jala = createCharacterStub('Jala');

      partyGainXp(100);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      updateFn({ world: { party: [jala] } } as unknown as GameState);

      expect(miscellaneousMessageLog).toHaveBeenCalledWith(
        '**Jala** reached level 2!',
      );
      expect(miscellaneousMessageLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncPartyHpFromCombat', () => {
    it('syncs hp and ep from the matching combatant, clamped to current max stats', () => {
      const jala = createCharacterStub('Jala');
      const combatant = {
        id: jala.id,
        hp: jala.stats.Health + 999,
        ep: jala.stats.Energy + 999,
      } as unknown as Combatant;

      syncPartyHpFromCombat([combatant]);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(jala.stats.Health);
      expect(result.world.party[0].ep).toBe(jala.stats.Energy);
    });

    it('leaves characters with no matching combatant untouched', () => {
      const jala = createCharacterStub('Jala');

      syncPartyHpFromCombat([]);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0]).toEqual(jala);
    });
  });

  describe('healPartyToFull', () => {
    it("restores every character's hp and ep to their current maximums", () => {
      const jala = {
        ...createCharacterStub('Jala'),
        hp: 1,
        ep: 0,
      };

      healPartyToFull();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(jala.stats.Health);
      expect(result.world.party[0].ep).toBe(jala.stats.Energy);
    });
  });

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }

  let fixtureItemCounter = 0;

  // A hand-built EquipmentItem instance for fixtures that need one - uses
  // its own counter (not the mocked uuid) so tests can construct armory
  // items independently of how many rngUuid calls the code under test
  // happens to make.
  function mockEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
    return {
      id: `fixture-item-${fixtureItemCounter++}` as EquipmentItemId,
      equipmentId,
      infusedItemIds: [],
    };
  }
});
