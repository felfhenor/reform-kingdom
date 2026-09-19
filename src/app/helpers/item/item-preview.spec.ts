import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  worldPartyState: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  recipeBackdropSprite: vi.fn(() => 'recipe-backdrop'),
  recipeResultContent: vi.fn(),
  recipeResultSpritesheet: vi.fn(() => 'equipment'),
  recipeStylizedName: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { worldPartyState } from '@helpers/state-game';
import {
  itemPreviewDisplay,
  resolveRewardDisplay,
} from '@helpers/item/item-preview';
import type {
  CharacterId,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
} from '@interfaces';

describe('itemPreviewDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces infusion stats for an item', () => {
    const item: ItemContent = {
      id: 'ore' as ItemId,
      __type: 'item',
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      rarity: 'Common',
      infusionStats: { Strength: 1 },
    } as ItemContent;

    expect(itemPreviewDisplay('item', item)).toEqual({
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      spritesheet: 'item',
      rarity: 'Common',
      stats: { Strength: 1 },
      skills: [],
    });
  });

  it('surfaces base stats, level requirement, and equippable heroes for equipment', () => {
    const equipment: EquipmentContent = {
      id: 'sword' as EquipmentId,
      __type: 'equipment',
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
      levelRequirement: 4,
      baseStats: { Strength: 5 },
      type: 'Sword',
    } as EquipmentContent;
    const warriorJob = { equippableTypes: ['Sword'] } as JobContent;
    vi.mocked(getEntry).mockReturnValue(warriorJob);
    vi.mocked(worldPartyState).mockReturnValue([
      { name: 'Alice', jobId: 'warrior' as JobId } as never,
    ]);

    expect(itemPreviewDisplay('equipment', equipment)).toEqual({
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      spritesheet: 'equipment',
      rarity: 'Rare',
      type: 'Sword',
      stats: { Strength: 5 },
      levelRequirement: 4,
      equippableHeroNames: ['Alice'],
      skills: [],
    });
  });

  it('resolves gatherYieldBonuses to their tradeskill display name and sprite', () => {
    const equipment: EquipmentContent = {
      id: 'trinket' as EquipmentId,
      __type: 'equipment',
      name: 'Trinket',
      description: 'Handy.',
      sprite: '0002',
      rarity: 'Uncommon',
      levelRequirement: 1,
      baseStats: {},
      type: 'Trinket',
      gatherYieldBonuses: [{ tradeskillId: 'woodworking' as never, value: 1 }],
    } as EquipmentContent;
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === 'woodworking'
        ? ({ name: 'Woodworking', sprite: '0009' } as never)
        : undefined,
    );
    vi.mocked(worldPartyState).mockReturnValue([]);

    expect(
      itemPreviewDisplay('equipment', equipment).gatherYieldBonuses,
    ).toEqual([
      { tradeskillName: 'Woodworking', tradeskillSprite: '0009', value: 1 },
    ]);
  });

  it('names only the party heroes whose job can equip the equipment type', () => {
    const equipment = {
      id: 'sword' as EquipmentId,
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
      levelRequirement: 4,
      baseStats: { Strength: 5 },
      type: 'Sword',
    } as EquipmentContent;
    const swordJob = { equippableTypes: ['Sword'] } as JobContent;
    const staffJob = { equippableTypes: ['Staff'] } as JobContent;

    vi.mocked(getEntry).mockImplementation((id: unknown) => {
      if (id === 'warrior') return swordJob as never;
      if (id === 'magician') return staffJob as never;
      return undefined;
    });
    vi.mocked(worldPartyState).mockReturnValue([
      {
        id: 'a' as CharacterId,
        name: 'Alice',
        jobId: 'warrior' as JobId,
      } as never,
      {
        id: 'b' as CharacterId,
        name: 'Bob',
        jobId: 'magician' as JobId,
      } as never,
    ]);

    expect(
      itemPreviewDisplay('equipment', equipment).equippableHeroNames,
    ).toEqual(['Alice']);
  });

  it('returns an empty array of equippable heroes when no hero can equip the type', () => {
    const equipment = {
      id: 'sword' as EquipmentId,
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
      levelRequirement: 4,
      baseStats: { Strength: 5 },
      type: 'Sword',
    } as EquipmentContent;
    const staffJob = { equippableTypes: ['Staff'] } as JobContent;

    vi.mocked(getEntry).mockReturnValue(staffJob);
    vi.mocked(worldPartyState).mockReturnValue([
      {
        id: 'b' as CharacterId,
        name: 'Bob',
        jobId: 'magician' as JobId,
      } as never,
    ]);

    expect(
      itemPreviewDisplay('equipment', equipment).equippableHeroNames,
    ).toEqual([]);
  });

  it('carries neither stats nor a level requirement for a collectible', () => {
    const collectible: CollectibleContent = {
      id: 'trinket' as CollectibleId,
      __type: 'collectible',
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
      effects: [],
    };

    expect(itemPreviewDisplay('collectible', collectible)).toEqual({
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      spritesheet: 'collectible',
      rarity: 'Legendary',
      skills: [],
    });
  });

  it('carries a collectible effects list when the collectible has one', () => {
    const collectible: CollectibleContent = {
      id: 'trinket' as CollectibleId,
      __type: 'collectible',
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
      effects: [{ effectType: 'GainStats', stat: 'Health', value: 5 }],
    };

    expect(
      itemPreviewDisplay('collectible', collectible).collectibleEffects,
    ).toEqual([{ effectType: 'GainStats', stat: 'Health', value: 5 }]);
  });
});

describe('resolveRewardDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an itemId to its display', () => {
    const item = {
      id: 'ore' as ItemId,
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      rarity: 'Common',
    } as ItemContent;
    vi.mocked(getEntry).mockReturnValue(item);

    expect(resolveRewardDisplay({ itemId: item.id })?.name).toBe('Copper Ore');
  });

  it('resolves an equipmentId to its display', () => {
    const equipment = {
      id: 'sword' as EquipmentId,
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
    } as EquipmentContent;
    vi.mocked(getEntry).mockReturnValue(equipment);
    vi.mocked(worldPartyState).mockReturnValue([]);

    expect(resolveRewardDisplay({ equipmentId: equipment.id })?.name).toBe(
      'Sword',
    );
  });

  it('resolves a collectibleId to its display', () => {
    const collectible = {
      id: 'trinket' as CollectibleId,
      __type: 'collectible',
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
      effects: [],
    } as CollectibleContent;
    vi.mocked(getEntry).mockReturnValue(collectible);

    expect(resolveRewardDisplay({ collectibleId: collectible.id })?.name).toBe(
      'Trinket',
    );
  });

  it('returns undefined when no id is set', () => {
    expect(resolveRewardDisplay({})).toBeUndefined();
  });

  it('returns undefined when the referenced id no longer resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      resolveRewardDisplay({ itemId: 'missing' as ItemId }),
    ).toBeUndefined();
  });
});
