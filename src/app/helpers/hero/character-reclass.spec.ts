import type * as AnalyticsHelper from '@helpers/engine/analytics';
import type {
  Character,
  CharacterId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  GameStateMaterials,
  IsContentItem,
  ItemContent,
  ItemId,
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

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  characterJobLevel,
  characterReclass,
  characterReclassCost,
  charactersReclass,
} from '@helpers/hero/character-reclass';
import { characterStatsForLevel, createCharacter } from '@helpers/hero/party';
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

  const mockGoldCoin: ItemContent = {
    id: 'item-gold-coin' as ItemId,
    name: 'Gold Coin',
    __type: 'item',
    description: '',
    sprite: '0000',
    rarity: 'Common',
  };

  function richMaterials(quantity = 100_000): GameStateMaterials {
    return { [mockGoldCoin.id]: { quantity, foundAt: 0 } };
  }

  function mockGetEntry(...entries: IsContentItem[]): void {
    const known = [mockCloak, mockStarterHat, mockGoldCoin, ...entries];
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
      materials: richMaterials(),
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
      materials: richMaterials(),
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
      materials: richMaterials(),
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
      materials: richMaterials(),
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
      materials: richMaterials(),
    } as unknown as GameState);

    expect(result.world.party[0].jobProgress['job-explorer' as JobId]).toEqual({
      level: 10,
      xp: { current: 50, maximum: jala.xp.maximum },
    });
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
      materials: richMaterials(),
    } as unknown as GameState).world.party[0];

    vi.clearAllMocks();
    mockGetEntry(mockJob, warriorJob);
    characterReclass(afterFirstReclass.id, 'job-explorer' as JobId);

    const updateFn2 = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn2({
      world: { party: [afterFirstReclass] },
      armory: [],
      materials: richMaterials(),
    } as unknown as GameState);

    expect(result.world.party[0].level).toBe(10);
    expect(result.world.party[0].xp).toEqual({
      current: 50,
      maximum: jala.xp.maximum,
    });
    expect(
      result.world.party[0].jobProgress['job-explorer' as JobId],
    ).toBeUndefined();
    expect(result.world.party[0].jobProgress['job-warrior' as JobId]).toEqual({
      level: 1,
      xp: { current: 0, maximum: 100 },
    });
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
      materials: richMaterials(),
    } as unknown as GameState);

    expect(result.world.party[1]).toEqual(spoorle);
  });

  describe('characterJobLevel', () => {
    it('returns 1 for a job never held', () => {
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      expect(characterJobLevel(jala, 'job-warrior' as JobId)).toBe(1);
    });

    it('returns the current level for the active job', () => {
      const jala = { ...createCharacterStub('Jala'), level: 10 };
      expect(characterJobLevel(jala, 'job-explorer' as JobId)).toBe(10);
    });

    it('returns the saved progress level for a previously held job', () => {
      const jala = createCharacterStub('Jala');
      jala.jobProgress['job-warrior' as JobId] = {
        level: 7,
        xp: { current: 0, maximum: 100 },
      };
      expect(characterJobLevel(jala, 'job-warrior' as JobId)).toBe(7);
    });
  });

  describe('characterReclassCost', () => {
    it('costs 100 gold per level of the target job', () => {
      const jala = createCharacterStub('Jala');
      jala.jobProgress['job-warrior' as JobId] = {
        level: 7,
        xp: { current: 0, maximum: 100 },
      };

      expect(characterReclassCost(jala, 'job-unheld' as JobId)).toBe(100);
      expect(characterReclassCost(jala, 'job-warrior' as JobId)).toBe(700);
    });
  });

  it('spends gold from the target job level, and leaves the state untouched if unaffordable', () => {
    mockGetEntry(mockJob, warriorJob);
    const jala = createCharacterStub('Jala');

    characterReclass(jala.id, 'job-warrior' as JobId);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const goldId = mockGoldCoin.id;

    const affordableResult = updateFn({
      world: { party: [jala] },
      armory: [],
      materials: richMaterials(100),
    } as unknown as GameState);

    expect(affordableResult.materials[goldId]?.quantity ?? 0).toBe(0);
    expect(affordableResult.world.party[0].jobId).toBe('job-warrior');

    const tooPoorState = {
      world: { party: [jala] },
      armory: [],
      materials: richMaterials(99),
    } as unknown as GameState;
    const unaffordableResult = updateFn(tooPoorState);

    expect(unaffordableResult).toBe(tooPoorState);
    expect(unaffordableResult.world.party[0].jobId).toBe('job-explorer');
  });

  describe('charactersReclass (batch)', () => {
    it('applies every pick within a single updateGamestate transaction', () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
      };

      charactersReclass([
        { characterId: jala.id, jobId: 'job-warrior' as JobId },
        { characterId: spoorle.id, jobId: 'job-warrior' as JobId },
      ]);

      expect(vi.mocked(updateGamestate).mock.calls.length).toBe(1);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [jala, spoorle] },
        armory: [],
        materials: richMaterials(),
      } as unknown as GameState);

      expect(result.world.party[0].jobId).toBe('job-warrior');
      expect(result.world.party[1].jobId).toBe('job-warrior');
    });

    // Whole batch runs as one updateGamestate call, so no other transaction can interleave between picks.
    it("shares one gold pool across the batch, so a later hero's reclass is skipped once an earlier one spends it down", () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = { ...createCharacterStub('Jala'), level: 1 };
      const spoorle = {
        ...createCharacterStub('Spoorle'),
        id: 'other-uuid' as CharacterId,
        level: 1,
      };

      charactersReclass([
        { characterId: jala.id, jobId: 'job-warrior' as JobId },
        { characterId: spoorle.id, jobId: 'job-warrior' as JobId },
      ]);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const goldId = mockGoldCoin.id;

      // Both cost 100g (level 1 target); fund only enough for one.
      const result = updateFn({
        world: { party: [jala, spoorle] },
        armory: [],
        materials: richMaterials(100),
      } as unknown as GameState);

      expect(result.world.party[0].jobId).toBe('job-warrior');
      expect(result.world.party[1].jobId).toBe('job-explorer');
      expect(result.materials[goldId]?.quantity ?? 0).toBe(0);
    });

    // Regression: charactersReclass is only ever called from a UI handler (never mid-tick), so
    // updateGamestate takes the deferred/async path there - the analytics calls must await it.
    it('fires analytics events only after the deferred updateGamestate transaction resolves', async () => {
      mockGetEntry(mockJob, warriorJob);
      const jala = createCharacterStub('Jala');

      vi.mocked(updateGamestate).mockImplementation(async (fn) => {
        await Promise.resolve();
        fn({
          world: { party: [jala] },
          armory: [],
          materials: richMaterials(),
        } as unknown as GameState);
      });

      await charactersReclass([
        { characterId: jala.id, jobId: 'job-warrior' as JobId },
      ]);

      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Hero:Reclass:Start:Warrior',
      );
      expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
        'Hero:Reclass:Start',
        1,
      );
    });
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
        materials: richMaterials(),
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
        materials: richMaterials(),
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
        materials: richMaterials(),
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
        materials: richMaterials(),
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
        materials: richMaterials(),
      } as unknown as GameState);

      expect(result.world.party[0].equipment).toEqual(defaultEquipment());
      expect(result.armory).toContainEqual(armorySword);
    });
  });
});
