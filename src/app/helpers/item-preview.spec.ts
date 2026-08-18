import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/party', () => ({
  partyGet: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { itemPreviewDisplay } from '@helpers/item-preview';
import { partyGet } from '@helpers/party';
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

    expect(itemPreviewDisplay(item, 'item')).toEqual({
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      spritesheet: 'item',
      rarity: 'Common',
      stats: { Strength: 1 },
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
    vi.mocked(partyGet).mockReturnValue([
      { name: 'Alice', jobId: 'warrior' as JobId } as never,
    ]);

    expect(itemPreviewDisplay(equipment, 'equipment')).toEqual({
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      spritesheet: 'equipment',
      rarity: 'Rare',
      stats: { Strength: 5 },
      levelRequirement: 4,
      equippableHeroNames: ['Alice'],
    });
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
    vi.mocked(partyGet).mockReturnValue([
      { id: 'a' as CharacterId, name: 'Alice', jobId: 'warrior' as JobId } as never,
      { id: 'b' as CharacterId, name: 'Bob', jobId: 'magician' as JobId } as never,
    ]);

    expect(itemPreviewDisplay(equipment, 'equipment').equippableHeroNames).toEqual([
      'Alice',
    ]);
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
    vi.mocked(partyGet).mockReturnValue([
      { id: 'b' as CharacterId, name: 'Bob', jobId: 'magician' as JobId } as never,
    ]);

    expect(itemPreviewDisplay(equipment, 'equipment').equippableHeroNames).toEqual([]);
  });

  it('carries neither stats nor a level requirement for a collectible', () => {
    const collectible: CollectibleContent = {
      id: 'trinket' as CollectibleId,
      __type: 'collectible',
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      rarity: 'Legendary',
    };

    expect(itemPreviewDisplay(collectible, 'collectible')).toEqual({
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      spritesheet: 'collectible',
      rarity: 'Legendary',
    });
  });
});
