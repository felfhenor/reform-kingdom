import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { captureAnalyticsEvents } from '@/testing/analytics';
import {
  buildCharacter,
  buildCombat,
  buildEquipmentItem,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  characterEquipFromArmory,
  equipmentInfuse,
  optimizeCharacterEquipment,
  replaceEquippedItemInstance,
  stateEquipArmoryItems,
} from '@helpers/hero/character-equipment';
import { infusionMaterialCost } from '@helpers/item/infusion';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  armoryState,
  gamestate,
  materialsState,
  updateGamestate,
  worldPartyState,
} from '@helpers/state-game';
import { taskEventEquipmentInfused } from '@helpers/task/task-events';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemId,
  JobId,
  SkillTreeNodeId,
} from '@interfaces';

const jobId = 'job-warrior' as JobId;
const hatlessJobId = 'job-hatless' as JobId;
const goldId = 'gold-coin' as ItemId;

function gear(
  id: string,
  type: EquipmentContent['type'],
  overrides: Partial<EquipmentContent> = {},
): EquipmentContent {
  return ensureEquipment({
    id: id as EquipmentId,
    name: id,
    type,
    slots: 1,
    ...overrides,
  });
}

const helmet = gear('helmet', 'Hat', {
  baseStats: { ...defaultStats(), Vitality: 3 },
});
const oldHat = gear('old-hat', 'Hat');
const circlet = gear('circlet', 'Hat', {
  baseStats: { ...defaultStats(), Strength: 4 },
});
const bastion = ensureSkillTreeNode({
  id: 'bastion' as SkillTreeNodeId,
  name: 'Warrior: Bastion',
  jobId,
  row: '',
});
const crown = gear('crown', 'Hat', { levelRequirement: 99 });
const sword = gear('sword', 'Sword', {
  baseStats: { ...defaultStats(), Strength: 10 },
});
const spear = gear('spear', 'Spear', {
  baseStats: { ...defaultStats(), Strength: 8 },
});
const dagger = gear('dagger', 'Sword', {
  baseStats: { ...defaultStats(), Strength: 1 },
});
const shield = gear('shield', 'Shield', {
  baseStats: { ...defaultStats(), Strength: 4 },
});
const bow = gear('bow', 'Bow');
const gem = ensureItem({
  id: 'ruby' as ItemId,
  name: 'Ruby',
  infusionStats: { ...defaultStats(), Strength: 2 },
});

const heroId = 'jala' as CharacterId;

function hero(equipment: Partial<EquipmentBlock> = {}): Character {
  return buildCharacter({
    id: heroId,
    name: 'Jala',
    jobId,
    equipment: { ...defaultEquipment(), ...equipment },
  });
}

function seedHero(
  equipment: Partial<EquipmentBlock> = {},
  armory: EquipmentItem[] = [],
  edit: (state: GameState) => void = () => undefined,
): Character {
  const character = hero(equipment);
  seedGamestate((state) => {
    state.world.party = [character];
    state.armory = armory;
    edit(state);
  });
  return character;
}

const inCombat = (state: GameState) => (state.world.combat = buildCombat());

function jala(): Character {
  return worldPartyState()[0];
}

function equip(item: EquipmentItem): boolean {
  return inTick(() => characterEquipFromArmory(heroId, item.id));
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([
    ensureJob({
      id: jobId,
      name: 'Warrior',
      baseStats: { ...defaultStats(), Strength: 5, Vitality: 5 },
      equippableTypes: ['Hat', 'Sword', 'Spear', 'Shield'],
      statPriority: [{ stat: 'Strength', multiplier: 1 }],
      specializationRows: ['Swashbuckler', 'Bastion'],
      specializationStatPriority: {
        Bastion: [{ stat: 'Vitality', multiplier: 5 }],
      },
    }),
    ensureJob({ id: hatlessJobId, name: 'Hatless' }),
    bastion,
    circlet,
    helmet,
    oldHat,
    crown,
    sword,
    dagger,
    spear,
    shield,
    bow,
    gem,
    ensureItem({ id: goldId, name: 'Gold Coin' }),
  ]);
});

describe('characterEquipFromArmory', () => {
  it('equips into the slot, sends the old item to the armory and counts the new stats', () => {
    const worn = buildEquipmentItem(oldHat.id);
    const fresh = buildEquipmentItem(helmet.id);
    const before = seedHero({ Helmet: worn }, [fresh]);
    const events = captureAnalyticsEvents();

    expect(equip(fresh)).toBe(true);

    expect(jala().equipment.Helmet).toEqual(fresh);
    expect(armoryState()).toEqual([worn]);
    expect(jala().stats.Vitality).toBe(before.stats.Vitality + 3);
    expect(events).toEqual(['Hero:Equip:Item:helmet']);
  });

  it('fills both hands with a two-hander, counting it once', () => {
    const item = buildEquipmentItem(spear.id);
    const before = seedHero({}, [item]);

    equip(item);

    expect(jala().equipment.Weapon).toEqual(item);
    expect(jala().equipment.Offhand).toEqual(item);
    expect(jala().stats.Strength).toBe(before.stats.Strength + 8);
  });

  it('returns a two-hander whole, once, when either hand is replaced', () => {
    const twoHander = buildEquipmentItem(spear.id);
    const offhand = buildEquipmentItem(shield.id);
    seedHero({ Weapon: twoHander, Offhand: twoHander }, [offhand]);

    equip(offhand);

    expect(jala().equipment).toMatchObject({
      Weapon: undefined,
      Offhand: offhand,
    });
    expect(armoryState()).toEqual([twoHander]);
  });

  it('refuses mid-combat, for gear the hero cannot use, or for an item not in the armory', () => {
    const tooHigh = buildEquipmentItem(crown.id);
    const wrongType = buildEquipmentItem(bow.id);
    seedHero({}, [tooHigh, wrongType]);
    const before = gamestate();

    expect(equip(tooHigh)).toBe(false);
    expect(equip(wrongType)).toBe(false);
    expect(equip(buildEquipmentItem(helmet.id))).toBe(false);
    expect(
      inTick(() => characterEquipFromArmory('gone' as CharacterId, tooHigh.id)),
    ).toBe(false);
    expect(gamestate()).toBe(before);

    const ok = buildEquipmentItem(helmet.id);
    seedHero({}, [ok], inCombat);
    expect(equip(ok)).toBe(false);
    expect(armoryState()).toEqual([ok]);
  });
});

describe('optimizeCharacterEquipment', () => {
  const optimize = () => inTick(() => optimizeCharacterEquipment(heroId));

  it('fills each slot with the best armory item for the jobs stat priority', async () => {
    const weaker = buildEquipmentItem(dagger.id);
    const best = buildEquipmentItem(sword.id);
    const offhand = buildEquipmentItem(shield.id);
    seedHero({}, [weaker, offhand, best]);

    await optimize();

    expect(jala().equipment.Weapon).toEqual(best);
    expect(jala().equipment.Offhand).toEqual(offhand);
    expect(armoryState()).toEqual([weaker]);
  });

  it.each([
    ['the jobs', [], 'circlet'],
    ['a held specializations', ['bastion'], 'helmet'],
  ])('ranks by %s stat priority', async (_, nodeIds, expected) => {
    const items = [helmet, circlet].map((hat) => buildEquipmentItem(hat.id));
    seedHero({}, items, (state) => {
      state.world.party[0].skillTreeNodes = {
        [jobId]: nodeIds as SkillTreeNodeId[],
      };
      state.world.party[0].skillTreeVersions = { [jobId]: 1 };
    });

    await optimize();

    expect(jala().equipment.Helmet?.equipmentId).toBe(expected);
  });

  it('swaps a two-hander for a stronger one-hander plus offhand, keeping the two-hander', async () => {
    const twoHander = buildEquipmentItem(spear.id);
    const oneHander = buildEquipmentItem(sword.id);
    const offhand = buildEquipmentItem(shield.id);
    seedHero({ Weapon: twoHander, Offhand: twoHander }, [oneHander, offhand]);

    await optimize();

    expect(jala().equipment).toMatchObject({
      Weapon: oneHander,
      Offhand: offhand,
    });
    expect(armoryState()).toEqual([twoHander]);
  });

  it('changes nothing mid-combat, or when the heros job is gone', async () => {
    const item = buildEquipmentItem(sword.id);
    seedHero({}, [item], inCombat);
    await optimize();
    expect(armoryState()).toEqual([item]);

    seedHero({}, [item], (state) => {
      state.world.party[0].jobId = 'gone' as JobId;
    });
    await optimize();
    expect(armoryState()).toEqual([item]);
  });
});

describe('replaceEquippedItemInstance', () => {
  it('swaps every slot holding the instance, recalculating stats', () => {
    const twoHander = buildEquipmentItem(spear.id);
    const character = hero({
      Weapon: twoHander,
      Offhand: twoHander,
      Helmet: buildEquipmentItem(helmet.id),
    });
    const infused = { ...twoHander, infusedItemIds: [gem.id] };

    const result = replaceEquippedItemInstance(character, infused);

    expect(result.equipment).toMatchObject({
      Weapon: infused,
      Offhand: infused,
      Helmet: character.equipment.Helmet,
    });
    expect(result.stats.Strength).toBe(character.stats.Strength + 2);
  });
});

describe('equipmentInfuse', () => {
  const cost = () => infusionMaterialCost(gem.id);

  function seedInfusion(
    equipment: Partial<EquipmentBlock>,
    armory: EquipmentItem[],
    edit: (state: GameState) => void = () => undefined,
  ): void {
    seedHero(equipment, armory, (state) => {
      applyMaterialDelta(state, gem.id, 1);
      applyMaterialDelta(state, goldId, cost());
      edit(state);
    });
  }

  const infuse = (item: EquipmentItem, slot = 0) =>
    inTick(() => equipmentInfuse(item.id, slot, gem.id));

  it('infuses an armory item in place, spending the material and its gold cost', () => {
    const item = buildEquipmentItem(helmet.id);
    seedInfusion({}, [item]);
    const events = captureAnalyticsEvents();

    expect(infuse(item)).toBe(true);

    expect(armoryState()[0].infusedItemIds).toEqual([gem.id]);
    expect(materialsState()[gem.id] ?? 0).toBe(0);
    expect(materialsState()[goldId] ?? 0).toBe(0);
    expect(events).toEqual(['Hero:Infuse:Item:Ruby']);
    expect(taskEventEquipmentInfused).toHaveBeenCalled();
  });

  it('infuses armory gear mid-combat, but equipped gear only out of combat', () => {
    const stored = buildEquipmentItem(helmet.id);
    seedInfusion({}, [stored], inCombat);
    expect(infuse(stored)).toBe(true);

    const worn = buildEquipmentItem(sword.id);
    seedInfusion({ Weapon: worn }, [], inCombat);
    expect(infuse(worn)).toBe(false);

    const before = hero({ Weapon: worn });
    seedInfusion({ Weapon: worn }, []);
    expect(infuse(worn)).toBe(true);
    expect(jala().equipment.Weapon?.infusedItemIds).toEqual([gem.id]);
    expect(jala().stats.Strength).toBe(before.stats.Strength + 2);
  });

  it('refuses an unowned item, a slot it does not have, or when the gold falls short', () => {
    const item = buildEquipmentItem(helmet.id);
    seedInfusion({}, [item]);
    expect(
      inTick(() => equipmentInfuse('gone' as EquipmentItemId, 0, gem.id)),
    ).toBe(false);
    expect(infuse(item, 1)).toBe(false);

    seedInfusion({}, [item], (state) => applyMaterialDelta(state, goldId, -1));
    expect(infuse(item)).toBe(false);
    expect(armoryState()).toEqual([item]);
  });
});

describe('stateEquipArmoryItems', () => {
  const rowanId = 'rowan' as CharacterId;

  function seedParty(armory: EquipmentItem[], firstJobId = jobId): void {
    seedGamestate((state) => {
      state.world.party = [
        { ...hero(), jobId: firstJobId },
        buildCharacter({ id: rowanId, name: 'Rowan', jobId }),
      ];
      state.armory = armory;
    });
  }

  function equipAll(items: EquipmentItem[]): string[] {
    let equipped: EquipmentContent[] = [];
    inTick(() =>
      updateGamestate((state) => {
        equipped = stateEquipArmoryItems(
          state,
          items.map((item) => item.id),
        );
        return state;
      }),
    );
    return equipped.map((content) => content.id);
  }

  const wearer = (item: EquipmentItem) =>
    worldPartyState().find((c) =>
      Object.values(c.equipment).some((worn) => worn?.id === item.id),
    )?.id;

  it('gives each item, in order, to the first hero whose slot is still open', () => {
    const [hat1, hat2, hat3] = [helmet, oldHat, circlet].map((hat) =>
      buildEquipmentItem(hat.id),
    );
    const blade = buildEquipmentItem(sword.id);
    seedParty([hat1, hat2, hat3, blade]);

    expect(equipAll([hat1, blade, hat2, hat3])).toEqual([
      'helmet',
      'sword',
      'old-hat',
    ]);
    expect([hat1, blade, hat2].map(wearer)).toEqual([heroId, heroId, rowanId]);
    expect(armoryState()).toEqual([hat3]);
  });

  it('counts a two-hander as filling both hands', () => {
    const twoHander = buildEquipmentItem(spear.id);
    const offhand = buildEquipmentItem(shield.id);
    seedParty([twoHander, offhand]);

    equipAll([twoHander, offhand]);

    expect([twoHander, offhand].map(wearer)).toEqual([heroId, rowanId]);
  });

  it('passes over a hero who cannot use the item', () => {
    const hat = buildEquipmentItem(helmet.id);
    seedParty([hat], hatlessJobId);

    equipAll([hat]);

    expect(wearer(hat)).toBe(rowanId);
  });

  it('skips gear nobody can use and items no longer in the armory', () => {
    const tooHigh = buildEquipmentItem(crown.id);
    const wrongType = buildEquipmentItem(bow.id);
    seedParty([tooHigh, wrongType]);

    expect(
      equipAll([tooHigh, wrongType, buildEquipmentItem(helmet.id)]),
    ).toEqual([]);
    expect(armoryState()).toEqual([tooHigh, wrongType]);
  });
});
