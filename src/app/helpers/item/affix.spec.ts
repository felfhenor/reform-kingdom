vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceRarity: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content';
import {
  affixEffectsOfKind,
  affixEffectSum,
  equipmentItemAffixEffects,
  equipmentItemAffixes,
  equipmentItemDisplayName,
  rollAffixIds,
} from '@helpers/item/affix';
import { rngChoiceRarity } from '@helpers/rng';
import type {
  AffixContent,
  AffixEffect,
  AffixId,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const strengthAffix: AffixContent = {
  id: 'affix-str' as AffixId,
  name: 'of Strength',
  __type: 'affix',
  description: '',
  rarity: 'Common',
  family: 'Strength',
  position: 'Suffix',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
};

const luckAffix: AffixContent = {
  id: 'affix-luck' as AffixId,
  name: 'of Luck',
  __type: 'affix',
  description: '',
  rarity: 'Common',
  family: 'Luck',
  position: 'Suffix',
  effects: [{ kind: 'Stat', stat: 'Luck', value: 3 }],
};

const weakeningAffix: AffixContent = {
  id: 'affix-weak' as AffixId,
  name: 'Weakening',
  __type: 'affix',
  description: '',
  rarity: 'Common',
  family: 'Strength',
  position: 'Prefix',
  effects: [{ kind: 'Stat', stat: 'Strength', value: -5 }],
};

const agilityPrefixAffix: AffixContent = {
  id: 'affix-agi' as AffixId,
  name: 'Swift',
  __type: 'affix',
  description: '',
  rarity: 'Common',
  family: 'Agility',
  position: 'Prefix',
  effects: [{ kind: 'Stat', stat: 'Agility', value: 3 }],
};

describe('rollAffixIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntriesByType).mockReturnValue([
      strengthAffix,
      luckAffix,
    ] as never);
  });

  it('rolls zero affixes for Common rarity', () => {
    expect(rollAffixIds('Common')).toEqual([]);
    expect(rngChoiceRarity).not.toHaveBeenCalled();
  });

  it('rolls one affix for Uncommon rarity', () => {
    vi.mocked(rngChoiceRarity).mockReturnValueOnce(strengthAffix);

    expect(rollAffixIds('Uncommon')).toEqual([strengthAffix.id]);
    expect(rngChoiceRarity).toHaveBeenCalledTimes(1);
  });

  it('excludes an already-rolled family from subsequent rolls', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      strengthAffix,
      agilityPrefixAffix,
    ] as never);
    vi.mocked(rngChoiceRarity)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(agilityPrefixAffix);

    expect(rollAffixIds('Rare')).toEqual([
      strengthAffix.id,
      agilityPrefixAffix.id,
    ]);
    expect(rngChoiceRarity).toHaveBeenNthCalledWith(1, [
      strengthAffix,
      agilityPrefixAffix,
    ]);
    expect(rngChoiceRarity).toHaveBeenNthCalledWith(2, [agilityPrefixAffix]);
  });

  it('stops rolling once the picker returns nothing (pool exhausted)', () => {
    vi.mocked(rngChoiceRarity)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(undefined);

    expect(rollAffixIds('Legendary')).toEqual([strengthAffix.id]);
    expect(rngChoiceRarity).toHaveBeenCalledTimes(2);
  });

  it('never rolls more than one Suffix-position affix, excluding remaining suffixes from later rolls even across different families', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      strengthAffix,
      luckAffix,
    ] as never);
    vi.mocked(rngChoiceRarity)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(undefined);

    expect(rollAffixIds('Legendary')).toEqual([strengthAffix.id]);
    // luckAffix is a different family but still a Suffix, so the second roll's eligible pool is empty.
    expect(rngChoiceRarity).toHaveBeenNthCalledWith(2, []);
  });

  it('keeps rolling Prefix affixes normally after the one Suffix slot is filled', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      strengthAffix,
      agilityPrefixAffix,
    ] as never);
    vi.mocked(rngChoiceRarity)
      .mockReturnValueOnce(strengthAffix)
      .mockReturnValueOnce(agilityPrefixAffix);

    expect(rollAffixIds('Rare')).toEqual([
      strengthAffix.id,
      agilityPrefixAffix.id,
    ]);
    expect(rngChoiceRarity).toHaveBeenNthCalledWith(2, [agilityPrefixAffix]);
  });
});

function buildItem(affixIds: AffixId[]): EquipmentItem {
  return {
    id: 'item-1' as EquipmentItemId,
    equipmentId: 'sword' as EquipmentId,
    infusedItemIds: [],
    affixIds,
  };
}

describe('equipmentItemAffixEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves each affixId to its content's effects", () => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === strengthAffix.id ? strengthAffix : undefined) as never,
    );

    expect(
      equipmentItemAffixEffects(buildItem([strengthAffix.id])),
    ).toEqual(strengthAffix.effects);
  });

  it('flattens multiple effects from a single affix', () => {
    const multiEffectAffix: AffixContent = {
      ...strengthAffix,
      effects: [
        { kind: 'Stat', stat: 'Strength', value: 3 },
        { kind: 'Resistance', tag: 'Stun', value: 5 },
      ],
    };
    vi.mocked(getEntry).mockImplementation(
      (id) =>
        (id === multiEffectAffix.id ? multiEffectAffix : undefined) as never,
    );

    expect(
      equipmentItemAffixEffects(buildItem([multiEffectAffix.id])),
    ).toEqual(multiEffectAffix.effects);
  });

  it('combines effects from multiple affixes on the same item', () => {
    vi.mocked(getEntry).mockImplementation(
      (id) =>
        (id === strengthAffix.id
          ? strengthAffix
          : id === luckAffix.id
            ? luckAffix
            : undefined) as never,
    );

    expect(
      equipmentItemAffixEffects(buildItem([strengthAffix.id, luckAffix.id])),
    ).toEqual([...strengthAffix.effects, ...luckAffix.effects]);
  });

  it('skips affixIds that resolve to no content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      equipmentItemAffixEffects(buildItem(['missing' as AffixId])),
    ).toEqual([]);
  });

  it('returns an empty array when the item has no affixes', () => {
    expect(equipmentItemAffixEffects(buildItem([]))).toEqual([]);
  });
});

describe('equipmentItemDisplayName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockAffixes(...affixes: AffixContent[]): void {
    vi.mocked(getEntry).mockImplementation(
      (id) => affixes.find((affix) => affix.id === id) as never,
    );
  }

  it('appends a suffix affix after the base name', () => {
    mockAffixes(strengthAffix);

    expect(
      equipmentItemDisplayName(buildItem([strengthAffix.id]), 'Copper Ring'),
    ).toBe('Copper Ring of Strength');
  });

  it('prepends a prefix affix before the base name', () => {
    mockAffixes(weakeningAffix);

    expect(
      equipmentItemDisplayName(buildItem([weakeningAffix.id]), 'Copper Ring'),
    ).toBe('Weakening Copper Ring');
  });

  it('composes a prefix and a suffix on the same item around the base name', () => {
    mockAffixes(weakeningAffix, luckAffix);

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves affixIds to their content, skipping ones that no longer exist', () => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === strengthAffix.id ? strengthAffix : undefined) as never,
    );

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
  tag: 'Slow',
  value: 2,
};
const strengthStatEffect: AffixEffect = {
  kind: 'Stat',
  stat: 'Strength',
  value: 3,
};
const grantSkillEffect: AffixEffect = {
  kind: 'GrantSkill',
  skillId: 'skill-1' as never,
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
    expect(affixEffectsOfKind([strengthStatEffect], 'Resistance')).toEqual(
      [],
    );
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
