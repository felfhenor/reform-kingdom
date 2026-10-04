import { describe, expect, it } from 'vitest';

import { ensureAffix } from '@helpers/content/ensure-affix';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { ensureWorker } from '@helpers/content/ensure-worker';
import {
  recipeBackdropSprite,
  recipeStylizedName,
} from '@helpers/crafting/recipes';
import { defaultStats } from '@helpers/defaults';
import {
  itemPreviewDisplay,
  resolveRewardDisplay,
} from '@helpers/item/item-preview';
import type {
  AffixId,
  CollectibleId,
  EquipmentId,
  EquipmentSkillId,
  ItemId,
  JobId,
  RecipeId,
  TradeskillId,
  WorkerId,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const ore = ensureItem({
  id: 'ore' as ItemId,
  name: 'Copper Ore',
  description: 'Shiny.',
  sprite: '0001',
  infusionStats: { ...defaultStats(), Strength: 1 },
});
const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  description: 'Sharp.',
  sprite: '0002',
  rarity: 'Rare',
  levelRequirement: 4,
  baseStats: { ...defaultStats(), Strength: 5 },
  type: 'Sword',
});
const trinket = ensureCollectible({
  id: 'trinket' as CollectibleId,
  name: 'Trinket',
  description: 'Curious.',
  sprite: '0003',
  rarity: 'Legendary',
});

describe('itemPreviewDisplay', () => {
  it('shows an item’s infusion stats', () => {
    expect(itemPreviewDisplay('item', ore)).toMatchObject({
      name: 'Copper Ore',
      description: 'Shiny.',
      sprite: '0001',
      spritesheet: 'item',
      rarity: 'Common',
      stats: ore.infusionStats,
      skills: [],
    });
    expect(itemPreviewDisplay('item', ore)).not.toHaveProperty(
      'levelRequirement',
    );
  });

  it('shows equipment stats, level requirement and the jobs that can use it', () => {
    seedContent([
      ensureJob({
        id: 'warrior' as JobId,
        shorthand: 'WAR',
        equippableTypes: ['Sword'],
      }),
      ensureJob({
        id: 'mage' as JobId,
        shorthand: 'MAG',
        equippableTypes: ['Staff'],
      }),
    ]);

    expect(itemPreviewDisplay('equipment', sword)).toMatchObject({
      name: 'Sword',
      description: 'Sharp.',
      sprite: '0002',
      spritesheet: 'equipment',
      rarity: 'Rare',
      type: 'Sword',
      stats: sword.baseStats,
      levelRequirement: 4,
      equippableHeroNames: ['WAR'],
      skills: [],
    });
  });

  it('names a rolled instance by its affixes', () => {
    const sharp = ensureAffix({
      id: 'sharp' as AffixId,
      name: 'Sharp',
      position: 'Prefix',
    });
    seedContent([sword, sharp]);

    expect(
      itemPreviewDisplay(
        'equipment',
        sword,
        buildEquipmentItem(sword.id, { affixIds: [sharp.id] }),
      ).name,
    ).toBe('Sharp Sword');
  });

  it('names gather yield bonuses by their tradeskill', () => {
    seedContent([
      ensureTradeskill({
        id: 'woodworking' as TradeskillId,
        name: 'Woodworking',
        sprite: '0009',
      }),
    ]);
    const axe = ensureEquipment({
      ...sword,
      gatherYieldBonuses: [
        { tradeskillId: 'woodworking' as TradeskillId, value: 1 },
      ],
    });

    expect(itemPreviewDisplay('equipment', axe).gatherYieldBonuses).toEqual([
      { tradeskillName: 'Woodworking', tradeskillSprite: '0009', value: 1 },
    ]);
  });

  it('names an infusion material’s skill stat bonuses by their skill', () => {
    seedContent([
      ensureSkill({
        id: 'snipe-1' as EquipmentSkillId,
        family: 'Snipe',
        sprite: '0004',
      }),
    ]);
    const shard = ensureItem({
      id: 'shard' as ItemId,
      infusionSkillStatBonuses: [
        { skillFamily: 'Snipe', stat: 'Agility', value: 0.5 },
      ],
    });

    expect(itemPreviewDisplay('item', shard).skillStatBonuses).toEqual([
      { skillName: 'Snipe', skillSprite: '0004', stat: 'Agility', value: 0.5 },
    ]);
  });

  it('shows a collectible’s effects, without stats or a level requirement', () => {
    expect(itemPreviewDisplay('collectible', trinket)).toEqual({
      name: 'Trinket',
      description: 'Curious.',
      sprite: '0003',
      spritesheet: 'collectible',
      rarity: 'Legendary',
      skills: [],
      collectibleEffects: undefined,
    });

    const charm = ensureCollectible({
      ...trinket,
      effects: [{ effectType: 'GainStats', stat: 'Health', value: 5 }],
    });
    expect(itemPreviewDisplay('collectible', charm).collectibleEffects).toEqual(
      charm.effects,
    );
  });
});

describe('resolveRewardDisplay', () => {
  it('previews an item, equipment, collectible or worker reward', () => {
    const worker = ensureWorker({ id: 'nell' as WorkerId, name: 'Nell' });
    seedContent([ore, sword, trinket, worker]);

    expect(resolveRewardDisplay({ itemId: ore.id })?.name).toBe('Copper Ore');
    expect(resolveRewardDisplay({ equipmentId: sword.id })?.name).toBe('Sword');
    expect(resolveRewardDisplay({ collectibleId: trinket.id })?.name).toBe(
      'Trinket',
    );
    expect(resolveRewardDisplay({ workerId: worker.id })).toEqual({
      name: 'Nell',
      description: worker.description,
      sprite: worker.sprite,
      spritesheet: 'worker',
      rarity: worker.rarity,
      skills: [],
    });
  });

  it('previews a recipe reward as what it crafts, under the recipe’s own name', () => {
    const smithing = ensureTradeskill({
      id: 'smithing' as TradeskillId,
      name: 'Smithing',
    });
    const recipe = ensureRecipe({
      id: 'sword-recipe' as RecipeId,
      name: 'Equipment: Sword',
      tradeskillId: smithing.id,
      result: { equipmentId: sword.id },
    });
    seedContent([sword, smithing, recipe]);

    expect(resolveRewardDisplay({ recipeId: recipe.id })).toMatchObject({
      name: recipeStylizedName(recipe),
      spritesheet: 'equipment',
      sprite: sword.sprite,
      backdropSprite: recipeBackdropSprite(),
    });
  });

  it('is undefined with no reward, or one gone from content', () => {
    seedContent([]);

    expect(resolveRewardDisplay({})).toBeUndefined();
    expect(resolveRewardDisplay({ itemId: ore.id })).toBeUndefined();
    expect(
      resolveRewardDisplay({ recipeId: 'gone' as RecipeId }),
    ).toBeUndefined();
  });
});
