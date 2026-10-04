import type {
  Character,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentItemType,
  EquipmentSlot,
  JobId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import { defaultEquipment } from '@helpers/defaults';
import { equippedItems } from '@helpers/item/equipment';
import { planEquipmentOptimization } from '@helpers/item/equipment-optimize';
import { ensureJob } from '@helpers/content/ensure-job';
import { getEntry } from '@helpers/content/content';
import {
  buildCharacter as buildHero,
  buildEquipmentItem,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';

function mockEquipmentItem(equipmentId: EquipmentId): EquipmentItem {
  return buildEquipmentItem(equipmentId, {
    id: `${equipmentId}-item` as EquipmentItemId,
  });
}

const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  type: 'Sword',
  baseStats: ensureStats({ Strength: 5, Agility: 1 }),
});

const spear = ensureEquipment({
  id: 'spear' as EquipmentId,
  type: 'Spear',
  baseStats: ensureStats({ Strength: 3 }),
});

const emptyEquipment = defaultEquipment();

describe('planEquipmentOptimization', () => {
  const job = ensureJob({
    id: 'job-warrior' as JobId,
    name: 'Warrior',
    equippableTypes: ['Sword', 'Spear', 'Shield', 'Hat'],
  });

  function buildCharacter(overrides: Partial<Character> = {}): Character {
    return buildHero({
      level: 5,
      jobId: 'job-warrior' as JobId,
      equipment: emptyEquipment,
      ...overrides,
    });
  }

  function mockContentEntries(...entries: EquipmentContent[]): void {
    seedContent([job, ...entries]);
  }

  it('prefers the candidate ranked higher by statPriority over one with a higher level requirement', () => {
    const strongSword = {
      ...sword,
      id: 'strong' as EquipmentId,
      levelRequirement: 1,
      baseStats: { ...sword.baseStats, Strength: 5 },
    };
    const weakHighLevelSword = {
      ...sword,
      id: 'weak-high-level' as EquipmentId,
      levelRequirement: 5,
      baseStats: { ...sword.baseStats, Strength: 2 },
    };
    mockContentEntries(strongSword, weakHighLevelSword);
    const strongItem = mockEquipmentItem(strongSword.id);
    const weakItem = mockEquipmentItem(weakHighLevelSword.id);

    const winners = planEquipmentOptimization(
      buildCharacter(),
      [strongItem, weakItem],
      [{ stat: 'Strength', multiplier: 1 }],
    );

    expect(winners).toEqual([{ item: strongItem, content: strongSword }]);
  });

  it('falls back to the highest level requirement when statPriority is empty', () => {
    const lowLevel = {
      ...sword,
      id: 'low' as EquipmentId,
      levelRequirement: 1,
    };
    const highLevel = {
      ...sword,
      id: 'high' as EquipmentId,
      levelRequirement: 5,
    };
    mockContentEntries(lowLevel, highLevel);
    const lowItem = mockEquipmentItem(lowLevel.id);
    const highItem = mockEquipmentItem(highLevel.id);

    const winners = planEquipmentOptimization(
      buildCharacter(),
      [lowItem, highItem],
      [],
    );

    expect(winners).toEqual([{ item: highItem, content: highLevel }]);
  });

  it('leaves a slot untouched when the currently equipped item already beats every armory candidate', () => {
    const weakSword = {
      ...sword,
      id: 'weak' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 2 },
    };
    const strongEquipped = {
      ...sword,
      id: 'equipped' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 20 },
    };
    mockContentEntries(weakSword, strongEquipped);
    const equippedItem = mockEquipmentItem(strongEquipped.id);
    const armoryItem = mockEquipmentItem(weakSword.id);
    const character = buildCharacter({
      equipment: { ...emptyEquipment, Weapon: equippedItem },
    });

    const winners = planEquipmentOptimization(
      character,
      [armoryItem],
      [{ stat: 'Strength', multiplier: 1 }],
    );

    expect(winners).toEqual([]);
  });

  it('leaves a slot untouched when an armory candidate exactly ties the currently equipped item', () => {
    const tiedSword = {
      ...sword,
      id: 'tied' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 10 },
    };
    const equippedSword = {
      ...sword,
      id: 'equipped' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 10 },
    };
    mockContentEntries(tiedSword, equippedSword);
    const equippedItem = mockEquipmentItem(equippedSword.id);
    const armoryItem = mockEquipmentItem(tiedSword.id);
    const character = buildCharacter({
      equipment: { ...emptyEquipment, Weapon: equippedItem },
    });

    const winners = planEquipmentOptimization(
      character,
      [armoryItem],
      [{ stat: 'Strength', multiplier: 1 }],
    );

    expect(winners).toEqual([]);
  });

  it('prefers a candidate that beats the equipped item on a stat outside statPriority, even when priority stats tie (e.g. Copper Bangle vs. Copper Ring, both 0 on Strength/Vitality/Agility/Resistance)', () => {
    const copperRing = {
      ...sword,
      id: 'copper-ring' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 0, Agility: 0, Energy: 3 },
    };
    const copperBangle = {
      ...sword,
      id: 'copper-bangle' as EquipmentId,
      baseStats: {
        ...sword.baseStats,
        Strength: 0,
        Agility: 0,
        Energy: 3,
        Health: 3,
      },
    };
    mockContentEntries(copperRing, copperBangle);
    const equippedRing = mockEquipmentItem(copperRing.id);
    const armoryBangle = mockEquipmentItem(copperBangle.id);
    const character = buildCharacter({
      equipment: { ...emptyEquipment, Weapon: equippedRing },
    });

    const winners = planEquipmentOptimization(
      character,
      [armoryBangle],
      [
        { stat: 'Strength', multiplier: 1 },
        { stat: 'Vitality', multiplier: 1 },
        { stat: 'Agility', multiplier: 1 },
        { stat: 'Resistance', multiplier: 1 },
      ],
    );

    expect(winners).toEqual([{ item: armoryBangle, content: copperBangle }]);
  });

  it("claims a two-handed item's secondary slot so nothing separate is chosen for it", () => {
    const shield = {
      ...sword,
      id: 'shield' as EquipmentId,
      type: 'Shield' as const,
    };
    mockContentEntries(spear, shield);
    const spearItem = mockEquipmentItem(spear.id);
    const shieldItem = mockEquipmentItem(shield.id);

    const winners = planEquipmentOptimization(
      buildCharacter(),
      [spearItem, shieldItem],
      [{ stat: 'Strength', multiplier: 1 }],
    );

    expect(winners).toEqual([{ item: spearItem, content: spear }]);
  });

  it('excludes slots unavailable for the character job (e.g. Artifact for a non-Magician)', () => {
    const artifact = {
      ...sword,
      id: 'artifact' as EquipmentId,
      type: 'Artifact' as const,
    };
    mockContentEntries(artifact);
    const artifactItem = mockEquipmentItem(artifact.id);

    const winners = planEquipmentOptimization(
      buildCharacter(),
      [artifactItem],
      [],
    );

    expect(winners).toEqual([]);
  });

  it('excludes candidates the hero cannot currently equip', () => {
    const tooHighLevel = {
      ...sword,
      id: 'too-high' as EquipmentId,
      levelRequirement: 99,
    };
    mockContentEntries(tooHighLevel);
    const item = mockEquipmentItem(tooHighLevel.id);

    const winners = planEquipmentOptimization(
      buildCharacter({ level: 5 }),
      [item],
      [],
    );

    expect(winners).toEqual([]);
  });

  it('prefers a tradeoff candidate whose non-priority stats net positive, even though one of those stats is negative', () => {
    const zeroRing = {
      ...sword,
      id: 'zero-ring' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 0, Agility: 0 },
    };
    const tradeoffBangle = {
      ...sword,
      id: 'tradeoff-bangle' as EquipmentId,
      baseStats: {
        ...sword.baseStats,
        Strength: 0,
        Agility: 0,
        Luck: 10,
        Vitality: -3,
      },
    };
    mockContentEntries(zeroRing, tradeoffBangle);
    const equippedItem = mockEquipmentItem(zeroRing.id);
    const armoryItem = mockEquipmentItem(tradeoffBangle.id);
    const character = buildCharacter({
      equipment: { ...emptyEquipment, Weapon: equippedItem },
    });

    const winners = planEquipmentOptimization(
      character,
      [armoryItem],
      [
        { stat: 'Strength', multiplier: 1 },
        { stat: 'Agility', multiplier: 1 },
      ],
    );

    expect(winners).toEqual([{ item: armoryItem, content: tradeoffBangle }]);
  });

  it('rejects a tradeoff candidate whose non-priority stats net negative overall', () => {
    const zeroRing = {
      ...sword,
      id: 'zero-ring' as EquipmentId,
      baseStats: { ...sword.baseStats, Strength: 0, Agility: 0 },
    };
    const cursedBangle = {
      ...sword,
      id: 'cursed-bangle' as EquipmentId,
      baseStats: {
        ...sword.baseStats,
        Strength: 0,
        Agility: 0,
        Luck: 2,
        Vitality: -5,
      },
    };
    mockContentEntries(zeroRing, cursedBangle);
    const equippedItem = mockEquipmentItem(zeroRing.id);
    const armoryItem = mockEquipmentItem(cursedBangle.id);
    const character = buildCharacter({
      equipment: { ...emptyEquipment, Weapon: equippedItem },
    });

    const winners = planEquipmentOptimization(
      character,
      [armoryItem],
      [
        { stat: 'Strength', multiplier: 1 },
        { stat: 'Agility', multiplier: 1 },
      ],
    );

    expect(winners).toEqual([]);
  });

  const priority = [{ stat: 'Intelligence' as const, multiplier: 1 }];

  // Every slot a winner fills is first cleared of whatever held it, as in the real equip path.
  function applyPlan(
    character: Character,
    armory: EquipmentItem[],
    winners: EquipmentArmoryEntry[],
  ): { character: Character; armory: EquipmentItem[] } {
    const equipment = { ...character.equipment };
    let owned = [...armory];
    winners.forEach(({ item, content }) => {
      const slots = EquipmentTypeToSlot[content.type];
      const displaced = equippedItems(equipment).filter((held) =>
        slots.some((slot) => equipment[slot]?.id === held.id),
      );
      (Object.keys(equipment) as (keyof typeof equipment)[]).forEach((slot) => {
        if (displaced.some((d) => d.id === equipment[slot]?.id)) {
          equipment[slot] = undefined;
        }
      });
      slots.forEach((slot) => (equipment[slot] = item));
      owned = [...owned.filter((o) => o.id !== item.id), ...displaced];
    });
    return { character: { ...character, equipment }, armory: owned };
  }

  function optimizeTwice(character: Character, armory: EquipmentItem[]) {
    const first = applyPlan(
      character,
      armory,
      planEquipmentOptimization(character, armory, priority),
    );
    return {
      ...first,
      secondPlan: planEquipmentOptimization(
        first.character,
        first.armory,
        priority,
      ),
    };
  }

  describe('weapon and offhand pairing', () => {
    function healerGear(
      hammerInt: number,
      staffInt: number,
      bucklerInt: number,
    ) {
      return {
        hammer: ensureEquipment({
          id: 'hammer' as EquipmentId,
          type: 'Mace',
          baseStats: ensureStats({ Intelligence: hammerInt }),
        }),
        orbstaff: ensureEquipment({
          id: 'orbstaff' as EquipmentId,
          type: 'Staff',
          baseStats: ensureStats({ Intelligence: staffInt }),
        }),
        buckler: ensureEquipment({
          id: 'buckler' as EquipmentId,
          type: 'Shield',
          baseStats: ensureStats({ Intelligence: bucklerInt }),
        }),
      };
    }

    function setupHealer(gear: ReturnType<typeof healerGear>) {
      const healer = ensureJob({
        id: 'job-healer' as JobId,
        name: 'Healer',
        equippableTypes: ['Mace', 'Staff', 'Shield'],
      });
      seedContent([healer, ...Object.values(gear)]);

      return {
        hammer: mockEquipmentItem(gear.hammer.id),
        staff: mockEquipmentItem(gear.orbstaff.id),
        buckler: mockEquipmentItem(gear.buckler.id),
      };
    }

    function healerWith(equipment: Partial<Character['equipment']>): Character {
      return buildCharacter({
        jobId: 'job-healer' as JobId,
        equipment: { ...emptyEquipment, ...equipment },
      });
    }

    it('swaps a two-hander for a one-hander plus an offhand when the pair scores higher', () => {
      const items = setupHealer(healerGear(6, 8, 4));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.staff, Offhand: items.staff }),
        [items.hammer, items.buckler],
        priority,
      );

      expect(winners.map((w) => w.item.id)).toEqual([
        items.hammer.id,
        items.buckler.id,
      ]);
    });

    it('keeps a two-hander that beats the one-hander plus offhand pair', () => {
      const items = setupHealer(healerGear(6, 12, 4));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.staff, Offhand: items.staff }),
        [items.hammer, items.buckler],
        priority,
      );

      expect(winners).toEqual([]);
    });

    it('fills an empty offhand next to an already-best one-hander', () => {
      const items = setupHealer(healerGear(6, 1, 4));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.hammer }),
        [items.staff, items.buckler],
        priority,
      );

      expect(winners.map((w) => w.item.id)).toEqual([items.buckler.id]);
    });

    it('never pairs a one-hander with a two-hander picked for the Offhand slot', () => {
      const items = setupHealer(healerGear(10, 8, 0));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.hammer }),
        [items.staff],
        priority,
      );

      expect(winners).toEqual([]);
    });

    it('settles after one pass when trading a two-hander for a one-hander plus offhand', () => {
      const items = setupHealer(healerGear(6, 8, 4));

      const result = optimizeTwice(
        healerWith({ Weapon: items.staff, Offhand: items.staff }),
        [items.hammer, items.buckler],
      );

      expect(result.character.equipment.Weapon?.id).toBe(items.hammer.id);
      expect(result.character.equipment.Offhand?.id).toBe(items.buckler.id);
      expect(result.secondPlan).toEqual([]);
    });

    it('settles after one pass when a lone one-hander beats the two-hander', () => {
      const items = setupHealer(healerGear(10, 8, 4));

      const result = optimizeTwice(
        healerWith({ Weapon: items.staff, Offhand: items.staff }),
        [items.hammer],
      );

      expect(result.character.equipment.Weapon?.id).toBe(items.hammer.id);
      expect(result.secondPlan).toEqual([]);
    });

    it('ignores a net-negative offhand rather than letting it drag the one-hander below a two-hander', () => {
      const items = setupHealer(healerGear(10, 9, -14));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.hammer }),
        [items.staff, items.buckler],
        priority,
      );

      expect(winners).toEqual([]);
    });

    it('picks a two-hander plus ammo for a job with no offhand types', () => {
      const ranger = ensureJob({
        id: 'job-ranger' as JobId,
        name: 'Ranger',
        equippableTypes: ['Dagger', 'Bow', 'Arrow'],
      });
      const dagger = ensureEquipment({
        id: 'dagger' as EquipmentId,
        type: 'Dagger',
        baseStats: ensureStats({ Intelligence: 5 }),
      });
      const bow = ensureEquipment({
        id: 'bow' as EquipmentId,
        type: 'Bow',
        baseStats: ensureStats({ Intelligence: 8 }),
      });
      const arrow = ensureEquipment({
        id: 'arrow' as EquipmentId,
        type: 'Arrow',
        baseStats: ensureStats({ Intelligence: 1 }),
      });
      seedContent([ranger, dagger, bow, arrow]);
      const daggerItem = mockEquipmentItem(dagger.id);
      const bowItem = mockEquipmentItem(bow.id);
      const arrowItem = mockEquipmentItem(arrow.id);

      const winners = planEquipmentOptimization(
        buildCharacter({
          jobId: 'job-ranger' as JobId,
          equipment: { ...emptyEquipment, Weapon: daggerItem },
        }),
        [bowItem, arrowItem],
        priority,
      );

      expect(winners.map((w) => w.item.id)).toEqual([bowItem.id, arrowItem.id]);
    });

    it('keeps a weapon equipped rather than trading it for a lone offhand that outscores it', () => {
      const items = setupHealer(healerGear(0, 1, 4));

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.staff, Offhand: items.staff }),
        [items.buckler],
        priority,
      );

      expect(winners).toEqual([]);
    });

    it('treats a legacy two-hander split across two instances as one item that an offhand would fully displace', () => {
      const items = setupHealer(healerGear(0, 8, 3));
      const staffB = {
        ...items.staff,
        id: 'staff-b' as EquipmentItemId,
      };

      const winners = planEquipmentOptimization(
        healerWith({ Weapon: items.staff, Offhand: staffB }),
        [items.buckler],
        priority,
      );

      expect(winners).toEqual([]);
    });
  });

  describe('multi-slot types outside the hands', () => {
    const slotTable = EquipmentTypeToSlot as Record<string, EquipmentSlot[]>;
    const robeType = 'Robe' as EquipmentItemType;

    beforeEach(() => {
      slotTable[robeType] = ['Armor', 'Helmet'];
    });

    afterEach(() => {
      delete slotTable[robeType];
      delete slotTable['Mantle'];
    });

    function setupBodyGear(robeInt: number, armorInt: number, hatInt: number) {
      const gear = [
        ensureEquipment({
          id: 'robe' as EquipmentId,
          type: robeType,
          baseStats: ensureStats({ Intelligence: robeInt }),
        }),
        ensureEquipment({
          id: 'armor' as EquipmentId,
          type: 'Cloth Armor',
          baseStats: ensureStats({ Intelligence: armorInt }),
        }),
        ensureEquipment({
          id: 'hat' as EquipmentId,
          type: 'Hat',
          baseStats: ensureStats({ Intelligence: hatInt }),
        }),
      ];
      // The test-only robe type isn't a real enum value, so set it after ensureJob would drop it.
      const job = {
        ...ensureJob({ id: 'job-sage' as JobId, name: 'Sage' }),
        equippableTypes: [
          robeType,
          'Cloth Armor',
          'Hat',
        ] as EquipmentItemType[],
      };
      seedContent([job, ...gear]);

      const [robe, armor, hat] = gear.map((g) => mockEquipmentItem(g.id));
      return { robe, armor, hat };
    }

    function sageWith(equipment: Partial<Character['equipment']>): Character {
      return buildCharacter({
        jobId: 'job-sage' as JobId,
        equipment: { ...emptyEquipment, ...equipment },
      });
    }

    it('swaps armor plus helmet for a robe that beats the pair', () => {
      const items = setupBodyGear(10, 4, 3);

      const result = optimizeTwice(
        sageWith({ Armor: items.armor, Helmet: items.hat }),
        [items.robe],
      );

      expect(result.character.equipment.Armor?.id).toBe(items.robe.id);
      expect(result.character.equipment.Helmet?.id).toBe(items.robe.id);
      expect(sortBy(result.armory, 'id')).toEqual(
        sortBy([items.armor, items.hat], 'id'),
      );
      expect(result.secondPlan).toEqual([]);
    });

    it('swaps a robe for armor plus helmet when the pair beats it', () => {
      const items = setupBodyGear(5, 4, 3);

      const result = optimizeTwice(
        sageWith({ Armor: items.robe, Helmet: items.robe }),
        [items.armor, items.hat],
      );

      expect(result.character.equipment.Armor?.id).toBe(items.armor.id);
      expect(result.character.equipment.Helmet?.id).toBe(items.hat.id);
      expect(result.armory).toEqual([items.robe]);
      expect(result.secondPlan).toEqual([]);
    });

    it('keeps a robe rather than trading it for a lone helmet that scores less', () => {
      const items = setupBodyGear(5, 4, 3);

      const winners = planEquipmentOptimization(
        sageWith({ Armor: items.robe, Helmet: items.robe }),
        [items.hat],
        priority,
      );

      expect(winners).toEqual([]);
    });

    it('never pairs a single-slot armor with a robe picked for the Helmet slot', () => {
      const items = setupBodyGear(5, 6, 0);

      const winners = planEquipmentOptimization(
        sageWith({}),
        [items.robe, items.armor],
        priority,
      );

      expect(winners.map((w) => w.item.id)).toEqual([items.armor.id]);
    });

    it('plans a chain of overlapping multi-slot types as one group', () => {
      const mantleType = 'Mantle' as EquipmentItemType;
      slotTable[mantleType] = ['Helmet', 'Accessory'];
      const items = setupBodyGear(5, 3, 3);
      const mantle = ensureEquipment({
        id: 'mantle' as EquipmentId,
        type: mantleType,
        baseStats: ensureStats({ Intelligence: 7 }),
      });
      const trinket = ensureEquipment({
        id: 'trinket' as EquipmentId,
        type: 'Trinket',
        baseStats: ensureStats({ Intelligence: 3 }),
      });
      const job = {
        ...ensureJob({ id: 'job-sage' as JobId, name: 'Sage' }),
        equippableTypes: [
          robeType,
          mantleType,
          'Cloth Armor',
          'Hat',
          'Trinket',
        ] as EquipmentItemType[],
      };
      seedContent([
        job,
        mantle,
        trinket,
        ...[items.robe, items.armor, items.hat].map((item) =>
          getEntry<EquipmentContent>(item.equipmentId)!,
        ),
      ]);
      const mantleItem = mockEquipmentItem(mantle.id);
      const trinketItem = mockEquipmentItem(trinket.id);

      const winners = planEquipmentOptimization(
        sageWith({}),
        [items.robe, items.armor, items.hat, mantleItem, trinketItem],
        priority,
      );

      expect(sortBy(winners.map((w) => w.item.id))).toEqual(
        sortBy([items.armor.id, mantleItem.id]),
      );
    });
  });

  it.each([-2, 0])(
    'leaves an empty slot empty rather than filling it with an item scoring %d',
    (intelligence) => {
      const cursedHat = ensureEquipment({
        id: 'cursed-hat' as EquipmentId,
        type: 'Hat',
        baseStats: ensureStats({ Intelligence: intelligence }),
      });
      mockContentEntries(cursedHat);

      const winners = planEquipmentOptimization(
        buildCharacter(),
        [mockEquipmentItem(cursedHat.id)],
        priority,
      );

      expect(winners).toEqual([]);
    },
  );
});
