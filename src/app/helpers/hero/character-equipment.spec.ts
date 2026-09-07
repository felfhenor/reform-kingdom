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

// A unique id per call (not a constant) - equipped-item dedup is now keyed
// by instance id, so two distinct equipped items in the same test must not
// collide on the same mocked uuid the way a constant mock would cause.
let mockUuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${mockUuidCounter++}`),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { currentCombat } from '@helpers/combat/combat-state';
import { getEntry } from '@helpers/content/content';
import { defaultStats } from '@helpers/defaults';
import {
  characterEquipFromArmory,
  optimizeCharacterEquipment,
} from '@helpers/hero/character-equipment';
import { createCharacter } from '@helpers/hero/party';
import { gamestate, updateGamestate } from '@helpers/state-game';

describe('Character Equipment Helper Functions', () => {
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

  function createCharacterStub(name: string): Character {
    return createCharacter(name, 'job-explorer' as JobId);
  }

  let fixtureItemCounter = 0;

  function mockEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
    return {
      id: `fixture-item-${fixtureItemCounter++}` as EquipmentItemId,
      equipmentId,
      infusedItemIds: [],
      affixIds: [],
    };
  }

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

  describe('optimizeCharacterEquipment', () => {
    const mockSword: EquipmentContent = {
      ...mockCloak,
      id: 'equip-sword' as EquipmentId,
      name: 'Iron Sword',
      type: 'Sword',
      baseStats: { ...defaultStats(), Strength: 10 },
    };

    const optimizingJob: JobContent = {
      ...mockJob,
      equippableTypes: ['Sword'],
      statPriority: ['Strength'],
    };

    it('equips the best available armory item for each eligible slot', () => {
      mockGetEntry(optimizingJob, mockSword);
      const jala = createCharacterStub('Jala');
      const armorySword = mockEquipmentItem(mockSword.id);
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      optimizeCharacterEquipment(jala.id);

      expect(updateGamestate).toHaveBeenCalledTimes(1);
      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = updateFn({
        world: { party: [jala] },
        armory: [armorySword],
      } as unknown as GameState);

      expect(state.world.party[0].equipment.Weapon).toEqual(armorySword);
      expect(state.armory).toEqual([]);
    });

    it('does nothing when nothing in the armory beats what is already equipped', () => {
      mockGetEntry(optimizingJob);
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      optimizeCharacterEquipment(jala.id);

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('does nothing when the character cannot be found', () => {
      mockGetEntry(optimizingJob);
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [] },
        armory: [],
      } as unknown as GameState);

      optimizeCharacterEquipment('missing-character' as CharacterId);

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('does nothing when the job cannot be found', () => {
      mockGetEntry();
      const jala = createCharacterStub('Jala');
      vi.mocked(gamestate).mockReturnValue({
        world: { party: [jala] },
        armory: [],
      } as unknown as GameState);

      optimizeCharacterEquipment(jala.id);

      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });
});
