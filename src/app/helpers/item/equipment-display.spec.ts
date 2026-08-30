vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
  equipmentItemGrantedSkillIds,
  equipmentItemTotalStats,
} from '@helpers/item/equipment-display';
import type {
  AffixContent,
  AffixId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ItemContent,
  ItemId,
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
  effects: [{ kind: 'Stat', stat: 'Strength', value: 4 }],
};

const stunAffix: AffixContent = {
  id: 'affix-stun' as AffixId,
  name: 'of Steadfastness',
  __type: 'affix',
  description: '',
  rarity: 'Uncommon',
  family: 'StunResist',
  position: 'Suffix',
  effects: [{ kind: 'Resistance', tag: 'Stun', value: 10 }],
};

const grantAffix: AffixContent = {
  id: 'affix-grant' as AffixId,
  name: 'of Aggression',
  __type: 'affix',
  description: '',
  rarity: 'Mystical',
  family: 'GrantAttack',
  position: 'Suffix',
  effects: [{ kind: 'GrantSkill', skillId: 'attack' }],
};

const crystal: ItemContent = {
  id: 'crystal' as ItemId,
  name: 'Minor Crystal',
  __type: 'item',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  infusionStats: {
    Agility: 0,
    Energy: 0,
    Health: 0,
    Intelligence: 0,
    Luck: 0,
    Resistance: 0,
    Strength: 2,
    Vitality: 0,
  },
};

function buildItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item-1' as EquipmentItemId,
    equipmentId: 'sword' as EquipmentId,
    infusedItemIds: [],
    affixIds: [],
    ...overrides,
  };
}

function mockContent(...entries: (AffixContent | ItemContent)[]): void {
  vi.mocked(getEntry).mockImplementation(
    (id) => entries.find((entry) => entry.id === id) as never,
  );
}

describe('equipmentItemBonusStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is zeroed when the item has no infusions or affixes', () => {
    expect(equipmentItemBonusStats(buildItem()).Strength).toBe(0);
  });

  it('includes an affix Stat bonus', () => {
    mockContent(strengthAffix);

    const bonus = equipmentItemBonusStats(
      buildItem({ affixIds: [strengthAffix.id] }),
    );
    expect(bonus.Strength).toBe(4);
  });

  it('sums infusion and affix bonuses to the same stat', () => {
    mockContent(strengthAffix, crystal);

    const bonus = equipmentItemBonusStats(
      buildItem({
        infusedItemIds: [crystal.id],
        affixIds: [strengthAffix.id],
      }),
    );
    expect(bonus.Strength).toBe(6);
  });
});

describe('equipmentItemBonusResistances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is zeroed when the item has no affixes', () => {
    expect(equipmentItemBonusResistances(buildItem()).Stun).toBe(0);
  });

  it('includes an affix Resistance bonus', () => {
    mockContent(stunAffix);

    const bonus = equipmentItemBonusResistances(
      buildItem({ affixIds: [stunAffix.id] }),
    );
    expect(bonus.Stun).toBe(10);
  });
});

describe('equipmentItemTotalStats', () => {
  const content: EquipmentContent = {
    id: 'sword' as EquipmentId,
    name: 'Sword',
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: {
      Agility: 0,
      Energy: 0,
      Health: 0,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 5,
      Vitality: 0,
    },
    type: 'Sword',
    slots: 0,
    grantedSkillIds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('equals baseStats when the item has no infusions or affixes', () => {
    expect(equipmentItemTotalStats(buildItem(), content).Strength).toBe(5);
  });

  it('adds the affix bonus on top of baseStats', () => {
    mockContent(strengthAffix);

    const total = equipmentItemTotalStats(
      buildItem({ affixIds: [strengthAffix.id] }),
      content,
    );
    expect(total.Strength).toBe(9);
  });
});

describe('equipmentItemGrantedSkillIds', () => {
  const content: EquipmentContent = {
    id: 'sword' as EquipmentId,
    name: 'Sword',
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: {
      Agility: 0,
      Energy: 0,
      Health: 0,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    type: 'Sword',
    slots: 0,
    grantedSkillIds: ['starshine-2'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("combines content-granted and affix-granted skills", () => {
    mockContent(grantAffix);

    const skillIds = equipmentItemGrantedSkillIds(
      buildItem({ affixIds: [grantAffix.id] }),
      content,
    );
    expect(skillIds).toEqual(['starshine-2', 'attack']);
  });

  it('dedupes a skill granted by both content and an affix', () => {
    const duplicateGrantAffix: AffixContent = {
      ...grantAffix,
      effects: [{ kind: 'GrantSkill', skillId: 'starshine-2' }],
    };
    mockContent(duplicateGrantAffix);

    const skillIds = equipmentItemGrantedSkillIds(
      buildItem({ affixIds: [duplicateGrantAffix.id] }),
      content,
    );
    expect(skillIds).toEqual(['starshine-2']);
  });

  it('returns just the content-granted skills when the item has no affixes', () => {
    const skillIds = equipmentItemGrantedSkillIds(buildItem(), content);
    expect(skillIds).toEqual(['starshine-2']);
  });
});
