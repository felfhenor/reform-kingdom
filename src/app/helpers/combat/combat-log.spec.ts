import { beforeEach, describe, expect, it } from 'vitest';

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
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { recipeStylizedName } from '@helpers/crafting/recipes';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import type {
  Combatant,
  EquipmentId,
  ItemId,
  MonsterId,
  RecipeId,
  TradeskillId,
} from '@interfaces';
import {
  buildCharacter,
  buildCombat,
  buildHeroCombatant,
  buildMonsterCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';

const withHealth = (combatant: Combatant, hp: number, maxHp: number) => ({
  ...combatant,
  hp,
  totalStats: { ...combatant.totalStats, Health: maxHp },
});

const jala = withHealth(
  buildHeroCombatant(buildCharacter({ name: 'Jala' }), { sprite: '0000' }),
  12,
  20,
);
const goblin = withHealth(
  buildMonsterCombatant(
    ensureMonster({ id: 'goblin' as MonsterId, name: 'Goblin' }),
    { sprite: '0011' },
  ),
  2,
  10,
);

const copperOre = ensureItem({
  id: 'copper-ore' as ItemId,
  name: 'Copper Ore',
  rarity: 'Uncommon',
});
const goblinSkull = ensureEquipment({
  id: 'goblin-skull' as EquipmentId,
  name: 'Goblin Skull',
  rarity: 'Uncommon',
});
const tailoring = ensureTradeskill({
  id: 'tailoring' as TradeskillId,
  name: 'Tailoring',
});
const cloakRecipe = ensureRecipe({
  id: 'cloak' as RecipeId,
  name: 'Equipment: Bone-Hewn Cloak',
  tradeskillId: tailoring.id,
});

const snapshotOf = (combatant: Combatant, spritesheet: string) => ({
  id: combatant.id,
  name: combatant.name,
  hp: combatant.hp,
  maxHp: combatant.totalStats.Health,
  sprite: combatant.sprite,
  spritesheet,
});

function logOne(...args: Parameters<typeof combatMessageLog>) {
  beginCombatLogCommits();
  combatMessageLog(...args);
  endCombatLogCommits();
  return combatLog()[0];
}

describe('combatMessageLog', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('snapshots every hero and guardian onto the entry, not just the actor', () => {
    const combat = buildCombat({ heroes: [jala], guardians: [goblin] });

    expect(logOne(combat, '**Jala** attacks **Goblin**.', jala)).toMatchObject({
      spritesheet: 'hero',
      combatants: [snapshotOf(jala, 'job'), snapshotOf(goblin, 'monster')],
    });
    expect(logOne(combat, 'Combat is over.').combatants).toEqual([
      snapshotOf(jala, 'job'),
      snapshotOf(goblin, 'monster'),
    ]);
  });

  it('puts an icon token in front of every bolded combatant token, leaving other bold text alone', () => {
    const combat = buildCombat({ heroes: [jala], guardians: [goblin] });

    expect(
      logOne(
        combat,
        `**${combatantMessageToken(jala)}** uses **Slash** on **${combatantMessageToken(goblin)}**.`,
      ).message,
    ).toBe(
      `@@icon-${jala.id}@@**@@${jala.id}@@** uses **Slash** on @@icon-${goblin.id}@@**@@${goblin.id}@@**.`,
    );
  });

  it('stores item icons only when given', () => {
    const combat = buildCombat();

    expect(
      logOne(combat, 'The party found copper ore!', undefined, {
        sprite: 'copper-ore',
        spritesheet: 'item',
      }).itemIcons,
    ).toEqual([{ sprite: 'copper-ore', spritesheet: 'item' }]);

    combatLogReset();
    expect(logOne(combat, 'Combat is over.').itemIcons).toBeUndefined();
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

    expect(combatLog()[0].itemIcons).toEqual([
      { sprite: 'wood', spritesheet: 'item' },
    ]);
  });

  it('stores every icon when given a list', () => {
    const icons = [
      { sprite: 'wood', spritesheet: 'item' as const },
      { sprite: 'stone', spritesheet: 'item' as const },
    ];
    categoryMessageLog('Raid', 'Larsia', 'Larsia lost stuff', icons);

    expect(combatLog()[0].itemIcons).toEqual(icons);
  });

  it('leaves the icon fields undefined without one', () => {
    categoryMessageLog('Travel', 'Wergen Woods', 'The party left.');

    expect(combatLog()[0].itemIcons).toBeUndefined();
  });
});

describe('combatantMessageToken', () => {
  it('embeds the combatant id in an opaque, id-addressable token', () => {
    expect(combatantMessageToken(jala)).toBe(`@@${jala.id}@@`);
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
    const item = copperOre;

    expect(itemNameHtml(item)).toBe(
      '<span class="text-Uncommon type-entity-name">Copper Ore</span>',
    );
  });

  it('uses the given display name instead of the item name when provided', () => {
    const item = copperOre;

    expect(itemNameHtml(item, 'copper ores')).toBe(
      '<span class="text-Uncommon type-entity-name">copper ores</span>',
    );
  });
});

describe('itemDropHtml', () => {
  it('keeps the singular form for a quantity of 1', () => {
    const item = copperOre;

    expect(itemDropHtml(item, 1)).toBe(
      '1 <span class="text-Uncommon type-entity-name">copper ore</span>',
    );
  });

  it('pluralizes the name for quantities greater than 1', () => {
    const item = copperOre;

    expect(itemDropHtml(item, 3)).toBe(
      '3 <span class="text-Uncommon type-entity-name">copper ores</span>',
    );
  });
});

describe('equipmentNameHtml', () => {
  it('wraps the equipment name in a rarity-colored span', () => {
    const equipment = goblinSkull;

    expect(equipmentNameHtml(equipment)).toBe(
      '<span class="text-Uncommon type-entity-name">Goblin Skull</span>',
    );
  });
});

describe('equipmentDropHtml', () => {
  it('renders the same rarity-colored span as equipmentNameHtml, with no quantity', () => {
    const equipment = goblinSkull;

    expect(equipmentDropHtml(equipment)).toBe(
      '<span class="text-Uncommon type-entity-name">Goblin Skull</span>',
    );
  });
});

describe('recipeNameHtml', () => {
  it('wraps the recipe stylized name in a plain span, with no rarity color', () => {
    seedContent([tailoring]);

    expect(recipeNameHtml(cloakRecipe)).toBe(
      `<span class="type-entity-name">${recipeStylizedName(cloakRecipe)}</span>`,
    );
  });
});

describe('recipeDropHtml', () => {
  it('renders the same span as recipeNameHtml, with no quantity', () => {
    seedContent([tailoring]);

    expect(recipeDropHtml(cloakRecipe)).toBe(recipeNameHtml(cloakRecipe));
  });
});
