import type * as RngHelper from '@helpers/rng';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngChoiceWeighted: vi.fn(actual.rngChoiceWeighted) };
});

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment } from '@helpers/content/ensure-item';
import {
  affixCanRollOn,
  affixEffectsOfKind,
  affixEffectSum,
  affixRollWeight,
  equipmentItemAffixEffects,
  equipmentItemAffixes,
  equipmentItemDisplayName,
  equipmentItemMiscAffixDescriptions,
  rollAffixIds,
} from '@helpers/item/affix';
import { rngChoiceWeighted } from '@helpers/rng';
import type {
  AffixEffect,
  AffixId,
  DropRarity,
  EquipmentItemType,
  EquipmentSkillId,
  EquipmentId,
  EquipmentItem,
  TradeskillId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const strengthAffix = ensureAffix({
  id: 'affix-str' as AffixId,
  name: 'of Strength',
  levelRequirement: 1,
  rarity: 'Common',
  family: 'Strength',
  position: 'Suffix',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
});

const luckAffix = ensureAffix({
  id: 'affix-luck' as AffixId,
  name: 'of Luck',
  levelRequirement: 1,
  rarity: 'Common',
  family: 'Luck',
  position: 'Suffix',
  effects: [{ kind: 'Stat', stat: 'Luck', value: 3 }],
});

const weakeningAffix = ensureAffix({
  id: 'affix-weak' as AffixId,
  name: 'Weakening',
  levelRequirement: 1,
  rarity: 'Common',
  family: 'Strength',
  position: 'Prefix',
  effects: [{ kind: 'Stat', stat: 'Strength', value: -5 }],
});

const agilityPrefixAffix = ensureAffix({
  id: 'affix-agi' as AffixId,
  name: 'Swift',
  levelRequirement: 1,
  rarity: 'Common',
  family: 'Agility',
  position: 'Prefix',
  effects: [{ kind: 'Stat', stat: 'Agility', value: 3 }],
});

const fluxAffix = ensureAffix({
  id: 'affix-flux' as AffixId,
  name: 'Prismatic',
  levelRequirement: 20,
  rarity: 'Mystical',
  family: 'FluxPrismatic',
  position: 'Prefix',
  fluxOnly: true,
  gearSlots: ['Weapon'],
  effects: [{ kind: 'ElementalBoon', element: 'Fire', value: 15 }],
});

function gear(
  rarity: DropRarity,
  levelRequirement: number,
  type: EquipmentItemType = 'Sword',
) {
  return ensureEquipment({ rarity, levelRequirement, type });
}

describe('rollAffixIds', () => {
  beforeEach(() => {
    vi.mocked(rngChoiceWeighted).mockReset();
    seedContent([strengthAffix, luckAffix]);
  });

  it('rolls zero affixes for Common rarity', () => {
    expect(rollAffixIds(gear('Common', 1))).toEqual([]);
    expect(rngChoiceWeighted).not.toHaveBeenCalled();
  });

  it('rolls one affix for Uncommon rarity', () => {
    vi.mocked(rngChoiceWeighted).mockReturnValueOnce(strengthAffix);

    expect(rollAffixIds(gear('Uncommon', 1))).toEqual([strengthAffix.id]);
    expect(rngChoiceWeighted).toHaveBeenCalledTimes(1);
  });

  it('excludes an already-rolled family from subsequent rolls', () => {
    seedContent([agilityPrefixAffix, weakeningAffix, strengthAffix]);
    vi.mocked(rngChoiceWeighted)
      .mockReturnValueOnce(weakeningAffix)
      .mockReturnValueOnce(agilityPrefixAffix);

    expect(rollAffixIds(gear('Rare', 1))).toEqual([
      weakeningAffix.id,
      agilityPrefixAffix.id,
    ]);
    // Weakening is a Prefix, so only the shared Strength family rules out the Strength suffix.
    expect(rngChoiceWeighted).toHaveBeenNthCalledWith(
      2,
      [agilityPrefixAffix],
      expect.any(Function),
    );
  });

  it('stops rolling once the picker returns nothing (pool exhausted)', () => {
    vi.mocked(rngChoiceWeighted)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(undefined);

    expect(rollAffixIds(gear('Legendary', 1))).toEqual([strengthAffix.id]);
    expect(rngChoiceWeighted).toHaveBeenCalledTimes(2);
  });

  it('never rolls more than one Suffix-position affix, excluding remaining suffixes from later rolls even across different families', () => {
    seedContent([strengthAffix, luckAffix]);
    vi.mocked(rngChoiceWeighted)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(undefined);

    expect(rollAffixIds(gear('Legendary', 1))).toEqual([strengthAffix.id]);
    // luckAffix is a different family but still a Suffix, so the second roll's eligible pool is empty.
    expect(rngChoiceWeighted).toHaveBeenNthCalledWith(
      2,
      [],
      expect.any(Function),
    );
  });

  it('leaves affixes gated above the item level out of the pool', () => {
    const gatedAffix = ensureAffix({
      ...agilityPrefixAffix,
      id: 'affix-gated' as AffixId,
      levelRequirement: 10,
    });
    seedContent([strengthAffix, gatedAffix]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(strengthAffix);

    rollAffixIds(gear('Uncommon', 9));
    expect(rngChoiceWeighted).toHaveBeenLastCalledWith(
      [strengthAffix],
      expect.any(Function),
    );

    rollAffixIds(gear('Uncommon', 10));
    expect(rngChoiceWeighted).toHaveBeenLastCalledWith(
      [strengthAffix, gatedAffix],
      expect.any(Function),
    );
  });

  it('keeps rolling Prefix affixes normally after the one Suffix slot is filled', () => {
    seedContent([strengthAffix, agilityPrefixAffix]);
    vi.mocked(rngChoiceWeighted)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(agilityPrefixAffix);

    expect(rollAffixIds(gear('Rare', 1))).toEqual([
      strengthAffix.id,
      agilityPrefixAffix.id,
    ]);
    expect(rngChoiceWeighted).toHaveBeenNthCalledWith(
      2,
      [agilityPrefixAffix],
      expect.any(Function),
    );
  });

  it('only offers flux-only affixes on a reforge', () => {
    seedContent([strengthAffix, fluxAffix]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(strengthAffix);

    rollAffixIds(gear('Uncommon', 20));
    expect(rngChoiceWeighted).toHaveBeenLastCalledWith(
      [strengthAffix],
      expect.any(Function),
    );

    rollAffixIds(gear('Uncommon', 20), true);
    expect(rngChoiceWeighted).toHaveBeenLastCalledWith(
      [strengthAffix, fluxAffix],
      expect.any(Function),
    );
  });

  it('leaves slot-restricted affixes out of non-matching gear', () => {
    seedContent([strengthAffix, fluxAffix]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(strengthAffix);

    rollAffixIds(gear('Uncommon', 20, 'Ring'), true);
    expect(rngChoiceWeighted).toHaveBeenLastCalledWith(
      [strengthAffix],
      expect.any(Function),
    );
  });
});

describe('affixCanRollOn', () => {
  it('gates by item level on drops and reforges alike', () => {
    expect(affixCanRollOn(fluxAffix, gear('Rare', 19), true)).toBe(false);
    expect(affixCanRollOn(fluxAffix, gear('Rare', 20), true)).toBe(true);
  });

  it('keeps flux-only affixes off fresh drops', () => {
    expect(affixCanRollOn(fluxAffix, gear('Rare', 20), false)).toBe(false);
  });

  it('matches by any slot the item type fills', () => {
    expect(affixCanRollOn(fluxAffix, gear('Rare', 20, 'Mace'), true)).toBe(
      true,
    );
    const offhandAffix = ensureAffix({
      ...fluxAffix,
      gearSlots: ['Offhand'],
    });
    expect(affixCanRollOn(offhandAffix, gear('Rare', 20, 'Bow'), true)).toBe(
      true,
    );
    expect(affixCanRollOn(offhandAffix, gear('Rare', 20, 'Sword'), true)).toBe(
      false,
    );
  });

  it('matches by exact item type when one is listed', () => {
    const trinketAffix = ensureAffix({
      ...fluxAffix,
      gearSlots: [],
      gearTypes: ['Trinket'],
    });
    expect(
      affixCanRollOn(trinketAffix, gear('Rare', 20, 'Trinket'), true),
    ).toBe(true);
    expect(
      affixCanRollOn(trinketAffix, gear('Rare', 20, 'Accessory'), true),
    ).toBe(false);
  });

  it('rolls anywhere when unrestricted', () => {
    expect(affixCanRollOn(strengthAffix, gear('Rare', 1, 'Arrow'), false)).toBe(
      true,
    );
  });
});

describe('affixRollWeight', () => {
  it('boosts flux-only affixes only on a reforge', () => {
    expect(affixRollWeight(fluxAffix, false)).toBe(3);
    expect(affixRollWeight(fluxAffix, true)).toBe(15);
    expect(
      affixRollWeight(ensureAffix({ ...fluxAffix, fluxOnly: false }), true),
    ).toBe(3);
  });
});

function buildItem(affixIds: AffixId[]): EquipmentItem {
  return buildEquipmentItem('sword' as EquipmentId, { affixIds });
}

describe('equipmentItemAffixEffects', () => {
  it("resolves each affixId to its content's effects", () => {
    seedContent([strengthAffix]);

    expect(equipmentItemAffixEffects(buildItem([strengthAffix.id]))).toEqual(
      strengthAffix.effects,
    );
  });

  it('flattens multiple effects from a single affix', () => {
    const multiEffectAffix = ensureAffix({
      ...strengthAffix,
      effects: [
        { kind: 'Stat', stat: 'Strength', value: 3 },
        { kind: 'Resistance', tag: 'Stun', value: 5 },
      ],
    });
    seedContent([multiEffectAffix]);

    expect(equipmentItemAffixEffects(buildItem([multiEffectAffix.id]))).toEqual(
      multiEffectAffix.effects,
    );
  });

  it('combines effects from multiple affixes on the same item', () => {
    seedContent([strengthAffix, luckAffix]);

    expect(
      equipmentItemAffixEffects(buildItem([strengthAffix.id, luckAffix.id])),
    ).toEqual([...strengthAffix.effects, ...luckAffix.effects]);
  });

  it('skips affixIds that resolve to no content', () => {
    seedContent([]);

    expect(
      equipmentItemAffixEffects(buildItem(['missing' as AffixId])),
    ).toEqual([]);
  });

  it('returns an empty array when the item has no affixes', () => {
    expect(equipmentItemAffixEffects(buildItem([]))).toEqual([]);
  });
});

describe('equipmentItemDisplayName', () => {
  it('appends a suffix affix after the base name', () => {
    seedContent([strengthAffix]);

    expect(
      equipmentItemDisplayName(buildItem([strengthAffix.id]), 'Copper Ring'),
    ).toBe('Copper Ring of Strength');
  });

  it('prepends a prefix affix before the base name', () => {
    seedContent([weakeningAffix]);

    expect(
      equipmentItemDisplayName(buildItem([weakeningAffix.id]), 'Copper Ring'),
    ).toBe('Weakening Copper Ring');
  });

  it('composes a prefix and a suffix on the same item around the base name', () => {
    seedContent([weakeningAffix, luckAffix]);

    expect(
      equipmentItemDisplayName(
        buildItem([weakeningAffix.id, luckAffix.id]),
        'Copper Ring',
      ),
    ).toBe('Weakening Copper Ring of Luck');
  });

  it('returns the bare base name when the item has no affixes', () => {
    expect(equipmentItemDisplayName(buildItem([]), 'Copper Ring')).toBe(
      'Copper Ring',
    );
  });
});

describe('equipmentItemAffixes', () => {
  it('resolves affixIds to their content, skipping ones that no longer exist', () => {
    seedContent([strengthAffix]);

    expect(
      equipmentItemAffixes(buildItem([strengthAffix.id, 'missing' as AffixId])),
    ).toEqual([strengthAffix]);
  });
});

const stunResistEffect: AffixEffect = {
  kind: 'Resistance',
  tag: 'Stun',
  value: 5,
};
const slowResistEffect: AffixEffect = {
  kind: 'Resistance',
  tag: 'StatDown',
  value: 2,
};
const strengthStatEffect: AffixEffect = {
  kind: 'Stat',
  stat: 'Strength',
  value: 3,
};
const grantSkillEffect: AffixEffect = {
  kind: 'GrantSkill',
  skillId: 'skill-1' as EquipmentSkillId,
};

describe('affixEffectsOfKind', () => {
  it('narrows to only the effects matching the given kind', () => {
    expect(
      affixEffectsOfKind(
        [stunResistEffect, slowResistEffect, strengthStatEffect],
        'Resistance',
      ),
    ).toEqual([stunResistEffect, slowResistEffect]);
  });

  it('returns an empty array when no effects match', () => {
    expect(affixEffectsOfKind([strengthStatEffect], 'Resistance')).toEqual([]);
  });

  it('returns an empty array for an empty input', () => {
    expect(affixEffectsOfKind([], 'Stat')).toEqual([]);
  });
});

describe('affixEffectSum', () => {
  it('sums the value of every effect of the given kind', () => {
    expect(
      affixEffectSum(
        [stunResistEffect, slowResistEffect, strengthStatEffect],
        'Resistance',
      ),
    ).toBe(7);
  });

  it('further narrows with the optional matches predicate', () => {
    expect(
      affixEffectSum(
        [stunResistEffect, slowResistEffect],
        'Resistance',
        (effect) => effect.tag === 'Stun',
      ),
    ).toBe(5);
  });

  it('returns 0 when no effects match the kind', () => {
    expect(affixEffectSum([strengthStatEffect], 'Resistance')).toBe(0);
  });

  it('treats an effect kind without a value field (GrantSkill) as 0', () => {
    expect(affixEffectSum([grantSkillEffect], 'GrantSkill')).toBe(0);
  });
});

describe('equipmentItemMiscAffixDescriptions', () => {
  it('includes the description of an affix whose effect has no dedicated display (CaravanBuyDiscount)', () => {
    const discountAffix = ensureAffix({
      ...strengthAffix,
      id: 'affix-discount' as AffixId,
      description: 'Discounts caravan purchases.',
      effects: [{ kind: 'CaravanBuyDiscount', value: 10 }],
    });
    seedContent([discountAffix]);

    expect(
      equipmentItemMiscAffixDescriptions(buildItem([discountAffix.id])),
    ).toEqual([discountAffix.description]);
  });

  it('excludes an affix whose only effects already have a dedicated display (Stat)', () => {
    seedContent([strengthAffix]);

    expect(
      equipmentItemMiscAffixDescriptions(buildItem([strengthAffix.id])),
    ).toEqual([]);
  });

  it('excludes an affix whose only effect now has a dedicated display (GatherYield)', () => {
    const gatherAffix = ensureAffix({
      ...strengthAffix,
      id: 'affix-gather' as AffixId,
      description: 'Yields more Woodworking materials when gathering.',
      effects: [
        {
          kind: 'GatherYield',
          tradeskillId: 'Woodworking' as TradeskillId,
          value: 1,
        },
      ],
    });
    seedContent([gatherAffix]);

    expect(
      equipmentItemMiscAffixDescriptions(buildItem([gatherAffix.id])),
    ).toEqual([]);
  });

  it('excludes an affix whose only effect now has a dedicated display (MonsterTypeDamage)', () => {
    const slayingAffix = ensureAffix({
      ...strengthAffix,
      id: 'affix-slaying' as AffixId,
      description: 'Increases damage dealt to Demon enemies by 20%.',
      effects: [{ kind: 'MonsterTypeDamage', monsterType: 'Demon', value: 20 }],
    });
    seedContent([slayingAffix]);

    expect(
      equipmentItemMiscAffixDescriptions(buildItem([slayingAffix.id])),
    ).toEqual([]);
  });

  it('returns an empty array when the item has no affixes', () => {
    expect(equipmentItemMiscAffixDescriptions(buildItem([]))).toEqual([]);
  });
});
