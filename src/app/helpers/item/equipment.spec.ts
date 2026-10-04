import { beforeEach, describe, expect, it } from 'vitest';

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import {
  defaultCombatStats,
  defaultEquipment,
  defaultMonsterTypeDamageBonus,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import {
  backfillEquipmentItem,
  canEquipItem,
  canModifyEquipment,
  characterCombatStatBonusTotals,
  characterTagResistances,
  equipmentAffixEffects,
  equipmentCombatStatTotals,
  equipmentGatherYieldBonuses,
  equipmentGrantedSkillIds,
  equipmentMonsterTypeDamageTotals,
  equipmentStatTotals,
  equipmentTagResistanceTotals,
  equippedItems,
  equippedItemsByPrimarySlot,
  equippedItemTypes,
  isSlotAvailableForJob,
  newEquipmentItem,
  pruneInvalidEquippedItems,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';
import type {
  AffixContent,
  AffixId,
  Combat,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSkillId,
  IsContentItem,
  ItemId,
  JobId,
  TradeskillId,
  TrainerTeachingId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const swordId = 'sword' as EquipmentId;
const helmetId = 'helmet' as EquipmentId;
const spearId = 'spear' as EquipmentId;
const staffId = 'staff' as EquipmentId;
const missingId = 'missing' as EquipmentId;
const crystalId = 'crystal' as ItemId;
const strengthAffixId = 'affix-str' as AffixId;
const grantAffixId = 'affix-grant' as AffixId;
const warriorId = 'warrior' as JobId;
const magicianId = 'magician' as JobId;
const rangerId = 'ranger' as JobId;

const sword = ensureEquipment({
  id: swordId,
  name: 'Sword',
  type: 'Sword',
  baseStats: { ...defaultStats(), Strength: 5, Agility: 1 },
  debuffResistances: { ...defaultTagResistances(), Stun: 3 },
  combatStats: { ...defaultCombatStats(), damageReflectPercent: 10 },
  monsterTypeDamage: { ...defaultMonsterTypeDamageBonus(), Humanoid: 25 },
});
const helmet = ensureEquipment({
  id: helmetId,
  name: 'Helmet',
  type: 'Hat',
  baseStats: { ...defaultStats(), Health: 10, Vitality: 2 },
  debuffResistances: { ...defaultTagResistances(), Stun: 2, Poison: 5 },
  combatStats: { ...defaultCombatStats(), reviveChance: 5 },
});
const spear = ensureEquipment({
  id: spearId,
  name: 'Copper Spear',
  type: 'Spear',
  baseStats: { ...defaultStats(), Strength: 3 },
});
const staff = ensureEquipment({
  id: staffId,
  name: 'Staff',
  type: 'Staff',
  grantedSkillIds: ['starshine-2' as EquipmentSkillId],
  gatherYieldBonuses: [
    { tradeskillId: 'woodworking' as TradeskillId, value: 1 },
  ],
});

const strengthAffix: AffixContent = ensureAffix({
  id: strengthAffixId,
  name: 'of Strength',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 4 }],
});

const baseContent: IsContentItem[] = [
  sword,
  helmet,
  spear,
  staff,
  strengthAffix,
  ensureAffix({
    id: grantAffixId,
    effects: [{ kind: 'GrantSkill', skillId: 'attack' as EquipmentSkillId }],
  }),
  ensureItem({
    id: crystalId,
    infusionStats: { ...defaultStats(), Strength: 2 },
    infusionDebuffResistances: { ...defaultTagResistances(), Stun: 1 },
  }),
  ensureJob({ id: warriorId, name: 'Warrior', equippableTypes: ['Sword'] }),
  ensureJob({ id: magicianId, name: 'Magician' }),
  ensureJob({ id: rangerId, name: 'Ranger' }),
];

function item(
  equipmentId: EquipmentId,
  overrides: Partial<EquipmentItem> = {},
): EquipmentItem {
  return buildEquipmentItem(equipmentId, {
    id: `${equipmentId}-1` as EquipmentItemId,
    ...overrides,
  });
}

function equipped(slots: Partial<EquipmentBlock>): EquipmentBlock {
  return { ...defaultEquipment(), ...slots };
}

const twoHanded = () => {
  const spearItem = item(spearId);
  return equipped({ Weapon: spearItem, Offhand: spearItem });
};

beforeEach(() => seedContent(baseContent));

describe('equipmentStatTotals', () => {
  it('sums base stats, infusions and affixes across distinct equipped items', () => {
    const totals = equipmentStatTotals(
      equipped({
        Weapon: item(swordId, {
          infusedItemIds: [crystalId],
          affixIds: [strengthAffixId],
        }),
        Helmet: item(helmetId),
      }),
    );

    expect(totals).toEqual({
      ...defaultStats(),
      Strength: 5 + 2 + 4,
      Agility: 1,
      Health: 10,
      Vitality: 2,
    });
  });

  it('is all zero with nothing equipped, and ignores gear whose content is gone', () => {
    expect(equipmentStatTotals(defaultEquipment())).toEqual(defaultStats());
    expect(equipmentStatTotals(equipped({ Weapon: item(missingId) }))).toEqual(
      defaultStats(),
    );
  });

  it('counts a two-handed item once even though it fills two slots', () => {
    expect(equipmentStatTotals(twoHanded()).Strength).toBe(3);
  });
});

describe('the other bonus dimensions', () => {
  const gear = () =>
    equipped({
      Weapon: item(swordId, { infusedItemIds: [crystalId] }),
      Helmet: item(helmetId),
    });

  it('sums debuff resistances, infusion resistances included', () => {
    expect(equipmentTagResistanceTotals(gear())).toEqual({
      ...defaultTagResistances(),
      Stun: 3 + 1 + 2,
      Poison: 5,
    });
  });

  it('sums combat stats', () => {
    expect(equipmentCombatStatTotals(gear())).toEqual({
      ...defaultCombatStats(),
      damageReflectPercent: 10,
      reviveChance: 5,
    });
  });

  it('sums monster-type damage', () => {
    expect(equipmentMonsterTypeDamageTotals(gear())).toEqual({
      ...defaultMonsterTypeDamageBonus(),
      Humanoid: 25,
    });
  });

  it("collects each item's gather yield bonuses", () => {
    expect(
      equipmentGatherYieldBonuses(equipped({ Weapon: item(staffId) })),
    ).toEqual([{ tradeskillId: 'woodworking', value: 1 }]);
    expect(equipmentGatherYieldBonuses(gear())).toEqual([]);
  });
});

describe('character bonus totals', () => {
  const steelskinId = 'steelskin' as TrainerTeachingId;

  beforeEach(() =>
    seedContent([
      ...baseContent,
      ensureTrainerTeaching({
        id: steelskinId,
        effects: [
          { kind: 'Resistance', tag: 'Bleed', value: 3 },
          { kind: 'CombatStat', stat: 'missChance', value: 2 },
        ],
      }),
    ]),
  );

  it("adds teachings learned under any job on top of the character's gear", () => {
    const character = buildCharacter({
      jobId: rangerId,
      equipment: equipped({ Weapon: item(swordId) }),
      teachings: { [warriorId]: [steelskinId] },
    });

    expect(characterTagResistances(character)).toEqual({
      ...defaultTagResistances(),
      Stun: 3,
      Bleed: 3,
    });
    expect(characterCombatStatBonusTotals(character)).toEqual({
      ...defaultCombatStats(),
      damageReflectPercent: 10,
      missChance: 2,
    });
  });
});

describe('equipmentGrantedSkillIds / equipmentAffixEffects', () => {
  it('collects content and affix-granted skills, deduped', () => {
    const skillIds = equipmentGrantedSkillIds(
      equipped({
        Weapon: item(staffId),
        Ring: item(staffId, { id: 'staff-2' as EquipmentItemId }),
        Helmet: item(helmetId, { affixIds: [grantAffixId] }),
      }),
    );

    expect(sortBy(skillIds)).toEqual(['attack', 'starshine-2']);
    expect(
      equipmentGrantedSkillIds(equipped({ Weapon: item(swordId) })),
    ).toEqual([]);
  });

  it("collects each distinct item's affix effects once", () => {
    const spearItem = item(spearId, { affixIds: [strengthAffixId] });

    expect(
      equipmentAffixEffects(
        equipped({ Weapon: spearItem, Offhand: spearItem }),
      ),
    ).toEqual(strengthAffix.effects);
    expect(equipmentAffixEffects(defaultEquipment())).toEqual([]);
  });
});

describe('equippedItems / equippedItemsByPrimarySlot / equippedItemTypes', () => {
  it('lists each distinct item once, a two-hander included', () => {
    const swordItem = item(swordId);
    const helmetItem = item(helmetId);
    const both = equipped({ Weapon: swordItem, Helmet: helmetItem });

    expect(equippedItems(both)).toEqual(
      expect.arrayContaining([swordItem, helmetItem]),
    );
    expect(equippedItems(both)).toHaveLength(2);
    expect(equippedItems(twoHanded())).toEqual([twoHanded().Weapon]);
    expect(equippedItems(defaultEquipment())).toEqual([]);
  });

  it('lists each item once from its primary slot, a two-hander too even with different instance ids per slot', () => {
    const legacy = equipped({
      Weapon: item(spearId, { id: 'weapon-instance' as EquipmentItemId }),
      Offhand: item(spearId, { id: 'offhand-instance' as EquipmentItemId }),
      Helmet: item(helmetId),
      Ring: item(missingId),
    });

    const items = equippedItemsByPrimarySlot(legacy);

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([legacy.Weapon, legacy.Helmet]),
    );
  });

  it('resolves the content type of each distinct item, skipping missing content', () => {
    const types = equippedItemTypes(
      equipped({
        Weapon: item(swordId),
        Offhand: item(spearId),
        Helmet: item(missingId),
      }),
    );

    expect(types).toEqual(expect.arrayContaining(['Sword', 'Spear']));
    expect(types).toHaveLength(2);
  });
});

describe('pruneInvalidEquippedItems', () => {
  it('clears only the slots whose equipment no longer exists', () => {
    const swordItem = item(swordId);

    expect(
      pruneInvalidEquippedItems(
        equipped({ Weapon: swordItem, Helmet: item(missingId) }),
      ),
    ).toEqual(equipped({ Weapon: swordItem }));
  });
});

describe('slotsHoldingEquipment', () => {
  it('returns every slot holding the given equipment, and nothing for others', () => {
    expect(slotsHoldingEquipment(twoHanded(), spearId)).toEqual([
      'Weapon',
      'Offhand',
    ]);
    expect(slotsHoldingEquipment(twoHanded(), swordId)).toEqual([]);
  });
});

describe('canModifyEquipment', () => {
  it('blocks equipment changes only while a combat is active', () => {
    seedGamestate();
    expect(canModifyEquipment()).toBe(true);

    seedGamestate((state) => (state.world.combat = {} as Combat));
    expect(canModifyEquipment()).toBe(false);
  });
});

describe('canEquipItem', () => {
  const warrior = buildCharacter({ jobId: warriorId, level: 5 });
  const requiring = (
    levelRequirement: number,
    overrides: Partial<EquipmentContent> = {},
  ) => ({ ...sword, levelRequirement, ...overrides });

  it("needs the hero's level and a job that can equip the type", () => {
    expect(canEquipItem(warrior, requiring(5))).toBe(true);
    expect(canEquipItem(warrior, requiring(6))).toBe(false);
    expect(canEquipItem(warrior, requiring(5, { type: 'Hat' }))).toBe(false);
    expect(
      canEquipItem({ ...warrior, jobId: 'gone' as JobId }, requiring(5)),
    ).toBe(false);
  });
});

describe('isSlotAvailableForJob', () => {
  it('gates Artifact to the Magician and Ammo to the Ranger, leaving other slots open', () => {
    expect(isSlotAvailableForJob('Weapon', rangerId)).toBe(true);
    expect(isSlotAvailableForJob('Artifact', magicianId)).toBe(true);
    expect(isSlotAvailableForJob('Artifact', rangerId)).toBe(false);
    expect(isSlotAvailableForJob('Ammo', rangerId)).toBe(true);
    expect(isSlotAvailableForJob('Ammo', magicianId)).toBe(false);
  });
});

describe('newEquipmentItem', () => {
  function legendary(levelRequirement: number) {
    seedContent([
      ensureEquipment({ ...sword, rarity: 'Legendary', levelRequirement }),
      ensureAffix({ ...strengthAffix, levelRequirement: 3 }),
    ]);
  }

  it('rolls affixes for the content rarity, within its level requirement', () => {
    legendary(5);

    expect(newEquipmentItem(swordId)).toMatchObject({
      equipmentId: swordId,
      infusedItemIds: [],
      affixIds: [strengthAffixId],
    });
  });

  it("never rolls an affix gated above the item's level requirement", () => {
    legendary(2);

    expect(newEquipmentItem(swordId).affixIds).toEqual([]);
  });

  it('uses the given affixes instead of rolling, and rolls nothing for missing content', () => {
    legendary(5);

    expect(newEquipmentItem(swordId, []).affixIds).toEqual([]);
    expect(newEquipmentItem(missingId).affixIds).toEqual([]);
  });
});

describe('backfillEquipmentItem', () => {
  it('backfills a missing id and defaults infusedItemIds/affixIds', () => {
    const backfilled = backfillEquipmentItem({
      equipmentId: swordId,
    } as EquipmentItem);

    expect(backfilled.id).toBeTruthy();
    expect(backfilled).toMatchObject({ infusedItemIds: [], affixIds: [] });
  });
});
