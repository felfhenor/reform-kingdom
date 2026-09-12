import {
  adventureLogMessageHtml,
  beginCombatLogCommits,
  categoryMessageLog,
  combatantMessageToken,
  combatLog,
  combatLogReset,
  combatMessageLog,
  endCombatLogCommits,
  equipmentDropHtml,
  equipmentNameHtml,
  itemDropHtml,
  itemNameHtml,
  recipeDropHtml,
  recipeNameHtml,
} from '@helpers/combat/combat-log';
import type {
  Combat,
  Combatant,
  EquipmentContent,
  ItemContent,
  RecipeContent,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

describe('combatMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('snapshots every hero/guardian id+name+hp+maxHp onto the entry, not just the actor', () => {
    const hero = {
      id: 'hero-1',
      name: 'Jala',
      isEnemy: false,
      sprite: '0000',
      hp: 12,
      totalStats: { Health: 20 },
    } as unknown as Combatant;
    const guardian = {
      id: 'guardian-1',
      name: 'Goblin',
      isEnemy: true,
      hp: 2,
      totalStats: { Health: 10 },
    } as unknown as Combatant;
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
      heroes: [hero],
      guardians: [guardian],
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, '**Jala** attacks **Goblin**.', hero);
    endCombatLogCommits();

    expect(combatLog()[0]).toMatchObject({
      spritesheet: 'hero',
      combatants: [
        { id: 'hero-1', name: 'Jala', hp: 12, maxHp: 20 },
        { id: 'guardian-1', name: 'Goblin', hp: 2, maxHp: 10 },
      ],
    });
  });

  it('still snapshots the roster when there is no actor', () => {
    const hero = {
      id: 'hero-1',
      name: 'Jala',
      hp: 12,
      totalStats: { Health: 20 },
    } as unknown as Combatant;
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
      heroes: [hero],
      guardians: [],
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, 'Combat is over.');
    endCombatLogCommits();

    expect(combatLog()[0].combatants).toEqual([
      { id: 'hero-1', name: 'Jala', hp: 12, maxHp: 20 },
    ]);
  });

  it('stores the icon sprite/spritesheet onto the entry when given', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
      heroes: [],
      guardians: [],
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, 'The party found copper ore!', undefined, {
      sprite: 'copper-ore',
      spritesheet: 'item',
    });
    endCombatLogCommits();

    expect(combatLog()[0]).toMatchObject({
      itemSprite: 'copper-ore',
      itemSpritesheet: 'item',
    });
  });

  it('leaves the icon fields undefined without one', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
      heroes: [],
      guardians: [],
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, 'Combat is over.');
    endCombatLogCommits();

    expect(combatLog()[0].itemSprite).toBeUndefined();
    expect(combatLog()[0].itemSpritesheet).toBeUndefined();
  });
});

describe('categoryMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('stores the icon sprite/spritesheet onto the entry when given', () => {
    categoryMessageLog('Gather', 'Wergen Woods', 'The party found wood!', {
      sprite: 'wood',
      spritesheet: 'item',
    });

    expect(combatLog()[0]).toMatchObject({
      itemSprite: 'wood',
      itemSpritesheet: 'item',
    });
  });

  it('leaves the icon fields undefined without one', () => {
    categoryMessageLog('Travel', 'Wergen Woods', 'The party left.');

    expect(combatLog()[0].itemSprite).toBeUndefined();
    expect(combatLog()[0].itemSpritesheet).toBeUndefined();
  });
});

describe('combatantMessageToken', () => {
  it('embeds the combatant id in an opaque, id-addressable token', () => {
    const combatant = { id: 'hero-1' } as unknown as Combatant;
    expect(combatantMessageToken(combatant)).toBe('@@hero-1@@');
  });
});

describe('adventureLogMessageHtml', () => {
  it('renders markdown emphasis inline, without wrapping paragraph tags', () => {
    expect(
      adventureLogMessageHtml('**Jala** attacks **Goblin** for 8 damage.'),
    ).toBe(
      '<strong>Jala</strong> attacks <strong>Goblin</strong> for 8 damage.',
    );
  });

  it('renders italic markdown', () => {
    expect(adventureLogMessageHtml('_Combat round 2._')).toBe(
      '<em>Combat round 2.</em>',
    );
  });

  it('passes plain text through unchanged', () => {
    expect(adventureLogMessageHtml('Combat is over.')).toBe('Combat is over.');
  });
});

describe('itemNameHtml', () => {
  it('wraps the item name in a rarity-colored span', () => {
    const item = { name: 'Copper Ore', rarity: 'Uncommon' } as ItemContent;

    expect(itemNameHtml(item)).toBe(
      '<span class="text-Uncommon font-semibold">Copper Ore</span>',
    );
  });

  it('uses the given display name instead of the item name when provided', () => {
    const item = { name: 'Copper Ore', rarity: 'Uncommon' } as ItemContent;

    expect(itemNameHtml(item, 'copper ores')).toBe(
      '<span class="text-Uncommon font-semibold">copper ores</span>',
    );
  });
});

describe('itemDropHtml', () => {
  it('keeps the singular form for a quantity of 1', () => {
    const item = { name: 'Copper Ore', rarity: 'Uncommon' } as ItemContent;

    expect(itemDropHtml(item, 1)).toBe(
      '1 <span class="text-Uncommon font-semibold">copper ore</span>',
    );
  });

  it('pluralizes the name for quantities greater than 1', () => {
    const item = { name: 'Copper Ore', rarity: 'Uncommon' } as ItemContent;

    expect(itemDropHtml(item, 3)).toBe(
      '3 <span class="text-Uncommon font-semibold">copper ores</span>',
    );
  });
});

describe('equipmentNameHtml', () => {
  it('wraps the equipment name in a rarity-colored span', () => {
    const equipment = {
      name: 'Goblin Skull',
      rarity: 'Uncommon',
    } as EquipmentContent;

    expect(equipmentNameHtml(equipment)).toBe(
      '<span class="text-Uncommon font-semibold">Goblin Skull</span>',
    );
  });
});

describe('equipmentDropHtml', () => {
  it('renders the same rarity-colored span as equipmentNameHtml, with no quantity', () => {
    const equipment = {
      name: 'Goblin Skull',
      rarity: 'Uncommon',
    } as EquipmentContent;

    expect(equipmentDropHtml(equipment)).toBe(
      '<span class="text-Uncommon font-semibold">Goblin Skull</span>',
    );
  });
});

describe('recipeNameHtml', () => {
  it('wraps the recipe name in a plain span, with no rarity color', () => {
    const recipe = { name: 'Equipment: Bone-Hewn Cloak' } as RecipeContent;

    expect(recipeNameHtml(recipe)).toBe(
      '<span class="font-semibold">Recipe - Equipment: Bone-Hewn Cloak</span>',
    );
  });
});

describe('recipeDropHtml', () => {
  it('renders the same span as recipeNameHtml, with no quantity', () => {
    const recipe = { name: 'Equipment: Bone-Hewn Cloak' } as RecipeContent;

    expect(recipeDropHtml(recipe)).toBe(
      '<span class="font-semibold">Recipe - Equipment: Bone-Hewn Cloak</span>',
    );
  });
});
