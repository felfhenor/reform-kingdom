import { itemPreviewDisplay } from '@helpers/item-preview';
import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

describe('itemPreviewDisplay', () => {
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

  it('surfaces base stats and level requirement for equipment', () => {
    const equipment: EquipmentContent = {
      id: 'sword' as EquipmentId,
      __type: 'equipment',
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      rarity: 'Rare',
      levelRequirement: 4,
      baseStats: { Strength: 5 },
    } as EquipmentContent;

    expect(itemPreviewDisplay(equipment, 'equipment')).toEqual({
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      spritesheet: 'equipment',
      rarity: 'Rare',
      stats: { Strength: 5 },
      levelRequirement: 4,
    });
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
