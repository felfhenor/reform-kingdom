import type {
  Character,
  CharacterId,
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

import { characterReclass } from '@helpers/character-reclass';
import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { characterStatsForLevel, createCharacter } from '@helpers/party';
import { updateGamestate } from '@helpers/state-game';

describe('characterReclass', () => {
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

  const mockStarterHat: EquipmentContent = {
    ...mockCloak,
    id: 'equip-hat-of-adventuring' as EquipmentId,
    name: 'Hat of Adventuring',
    baseStats: defaultStats(),
    type: 'Hat',
  };

  function mockGetEntry(...entries: IsContentItem[]): void {
    const known = [mockCloak, mockStarterHat, ...entries];
    vi.mocked(getEntry).mockImplementation(
      (idOrName) =>
        known.find(
          (entry) => entry.id === idOrName || entry.name === idOrName,
        ) as never,
    );
  }

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }

  let fixtureItemCounter = 0;

  function mockEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
    return {
      id: `fixture-item-${fixtureItemCounter++}` as EquipmentItemId,
      equipmentId,
      infusedItemIds: [],
    };
  }

  beforeEach(() => {
    mockUuidCounter = 0;
    vi.clearAllMocks();
  });

  // `equippableTypes: []` keeps auto-optimize from picking up the vacated starter gear - these tests cover job-swap mechanics only.
  const warriorJob: JobContent = {
    ...mockJob,
    id: 'job-warrior' as JobId,
    name: 'Warrior',
    baseStats: { ...mockJob.baseStats, Health: 150, Strength: 15 },
    equippableTypes: [],
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

  describe('auto-optimize equipment', () => {
    const mockSword: EquipmentContent = {
      ...mockCloak,
      id: 'equip-sword' as EquipmentId,
      name: 'Iron Sword',
      type: 'Sword',
      baseStats: { ...defaultStats(), Strength: 10 },
    };

    const mockSpear: EquipmentContent = {
      ...mockCloak,
      id: 'equip-spear' as EquipmentId,
      name: 'Copper Spear',
      type: 'Spear',
      baseStats: { ...defaultStats(), Strength: 3 },
    };

    const optimizingWarriorJob: JobContent = {
      ...mockJob,
      id: 'job-warrior' as JobId,
      name: 'Warrior',
      equippableTypes: ['Sword', 'Spear'],
      statPriority: ['Strength'],
    };

    it('equips the best available armory item into the new job right after reclassing', () => {
      mockGetEntry(mockJob, optimizingWarriorJob, mockSword);
      const jala = createCharacterStub('Jala');
      const armorySword = mockEquipmentItem(mockSword.id);

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      expect(result.world.party[0].equipment.Weapon).toEqual(armorySword);
      expect(result.armory).not.toContainEqual(armorySword);
    });

    it('recalculates stats to include the newly auto-equipped gear', () => {
      mockGetEntry(mockJob, optimizingWarriorJob, mockSword);
      const jala = createCharacterStub('Jala');
      const armorySword = mockEquipmentItem(mockSword.id);

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      expect(result.world.party[0].stats.Strength).toBe(
        optimizingWarriorJob.baseStats.Strength + mockSword.baseStats.Strength,
      );
    });

    it('leaves the armory untouched when nothing in it fits the new job', () => {
      const noSwordsWarriorJob: JobContent = {
        ...optimizingWarriorJob,
        equippableTypes: [],
      };
      mockGetEntry(mockJob, noSwordsWarriorJob, mockSword);
      const jala = createCharacterStub('Jala');
      const armorySword = mockEquipmentItem(mockSword.id);

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      expect(result.world.party[0].equipment.Weapon).toBeUndefined();
      expect(result.armory).toContainEqual(armorySword);
    });

    it('equips a two-handed item into every slot it declares at once', () => {
      mockGetEntry(mockJob, optimizingWarriorJob, mockSpear);
      const jala = createCharacterStub('Jala');
      const armorySpear = mockEquipmentItem(mockSpear.id);

      characterReclass(jala.id, 'job-warrior' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [armorySpear],
      } as unknown as GameState);

      expect(result.world.party[0].equipment.Weapon).toEqual(armorySpear);
      expect(result.world.party[0].equipment.Offhand).toEqual(armorySpear);
      expect(result.armory).not.toContainEqual(armorySpear);
    });

    it('leaves equipment empty and does not crash when the new job cannot be found', () => {
      mockGetEntry(mockJob, mockSword);
      const jala = createCharacterStub('Jala');
      const armorySword = mockEquipmentItem(mockSword.id);

      characterReclass(jala.id, 'unknown-job' as JobId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      expect(result.world.party[0].equipment).toEqual(defaultEquipment());
      expect(result.armory).toContainEqual(armorySword);
    });
  });
});
