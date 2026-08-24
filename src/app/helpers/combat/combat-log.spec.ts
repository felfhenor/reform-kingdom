import {
  adventureLogMessageHtml,
  adventureLogTimestampTooltip,
  beginCombatLogCommits,
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
  travelMessageLog,
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

  it('snapshots the actor hp/maxHp onto the entry', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
    } as unknown as Combat;
    const actor = {
      isEnemy: false,
      sprite: '0000',
      hp: 12,
      totalStats: { Health: 20 },
    } as unknown as Combatant;

    beginCombatLogCommits();
    combatMessageLog(combat, '**Jala** attacks Goblin.', actor);
    endCombatLogCommits();

    expect(combatLog()[0]).toMatchObject({
      hp: 12,
      maxHp: 20,
      spritesheet: 'hero',
    });
  });

  it('leaves hp/maxHp undefined when there is no actor', () => {
    const combat = {
      id: 'combat-1',
      locationName: 'Field Ruins',
    } as unknown as Combat;

    beginCombatLogCommits();
    combatMessageLog(combat, 'Combat is over.');
    endCombatLogCommits();

    expect(combatLog()[0].hp).toBeUndefined();
    expect(combatLog()[0].maxHp).toBeUndefined();
  });
});

describe('travelMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('pushes a Travel-kind entry with no combatId onto the shared adventure log', () => {
    travelMessageLog('Duchy of Carrina', 'The party left for Field Ruins.');

    expect(combatLog()).toHaveLength(1);
    expect(combatLog()[0].combatId).toBeUndefined();
    expect(combatLog()[0]).toMatchObject({
      kind: 'Travel',
      locationName: 'Duchy of Carrina',
      message: 'The party left for Field Ruins.',
    });
  });

  it('prepends new entries so the log stays newest-first', () => {
    travelMessageLog('Duchy of Carrina', 'The party left for Field Ruins.');
    travelMessageLog('Field Ruins', 'The party has arrived at Field Ruins.');

    expect(combatLog().map((entry) => entry.message)).toEqual([
      'The party has arrived at Field Ruins.',
      'The party left for Field Ruins.',
    ]);
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

describe('adventureLogTimestampTooltip', () => {
  it('formats a timestamp as zero-padded HH:mm:ss', () => {
    const date = new Date(2026, 0, 1, 4, 5, 6);
    expect(adventureLogTimestampTooltip(date.getTime())).toBe('04:05:06');
  });
});
