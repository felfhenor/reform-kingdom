import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import { defaultAffinities } from '@helpers/defaults';
import {
  characterElementalBoons,
  characterElementalResistances,
  equipmentGearElements,
} from '@helpers/item/equipment-element';
import type {
  AffixId,
  EquipmentBlock,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ItemId,
  JobId,
  TrainerTeachingId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const felArmorId = 'fel-armor' as EquipmentId;
const waterSwordId = 'water-sword' as EquipmentId;
const plainRingId = 'plain-ring' as EquipmentId;
const emberId = 'ember' as ItemId;
const flamewardId = 'flameward' as AffixId;
const blazingId = 'blazing' as AffixId;
const flammableId = 'flammable' as AffixId;
const ofFlameId = 'of-flame' as AffixId;
const fireTeachingId = 'fire-teaching' as TrainerTeachingId;
const warriorId = 'warrior' as JobId;

beforeEach(() =>
  seedContent([
    ensureEquipment({
      id: felArmorId,
      type: 'Metal Armor',
      elementalResistances: { ...defaultAffinities(), Fire: 10 },
      slots: 1,
    }),
    ensureEquipment({ id: waterSwordId, type: 'Sword', elements: ['Water'] }),
    ensureEquipment({ id: plainRingId, type: 'Ring' }),
    ensureItem({
      id: emberId,
      infusionElementalResistances: { ...defaultAffinities(), Fire: 5 },
    }),
    ensureAffix({
      id: flamewardId,
      effects: [{ kind: 'ElementalResistance', element: 'Fire', value: 70 }],
    }),
    ensureAffix({
      id: flammableId,
      effects: [{ kind: 'ElementalResistance', element: 'Water', value: -10 }],
    }),
    ensureAffix({
      id: blazingId,
      effects: [{ kind: 'ElementalBoon', element: 'Fire', value: -30 }],
    }),
    ensureAffix({
      id: ofFlameId,
      effects: [{ kind: 'ElementConversion', element: 'Fire' }],
    }),
    ensureTrainerTeaching({
      id: fireTeachingId,
      effects: [{ kind: 'ElementalBoon', element: 'Air', value: 15 }],
    }),
  ]),
);

function item(
  equipmentId: EquipmentId,
  overrides: Partial<EquipmentItem> = {},
): EquipmentItem {
  return buildEquipmentItem(equipmentId, {
    id: `${equipmentId}-item` as EquipmentItemId,
    ...overrides,
  });
}

function equipped(slots: Partial<EquipmentBlock>): EquipmentBlock {
  return { ...buildCharacter().equipment, ...slots };
}

describe('characterElementalResistances', () => {
  it('sums base, infusion and affix sources, clamped to the cap', () => {
    const character = buildCharacter({
      equipment: equipped({
        Armor: item(felArmorId, {
          infusedItemIds: [emberId],
          affixIds: [flamewardId],
        }),
        Ring: item(plainRingId, { affixIds: [flammableId] }),
      }),
    });

    // Fire 10 + 5 + 70 = 85, capped at 75.
    expect(characterElementalResistances(character)).toEqual({
      ...defaultAffinities(),
      Fire: 75,
      Water: -10,
    });
  });
});

describe('characterElementalBoons', () => {
  it('folds in trainer teachings and floors negative boons at 0', () => {
    const character = buildCharacter({
      equipment: equipped({
        Ring: item(plainRingId, { affixIds: [blazingId] }),
      }),
      teachings: { [warriorId]: [fireTeachingId] },
    });

    expect(characterElementalBoons(character)).toEqual({
      ...defaultAffinities(),
      Air: 15,
    });
  });
});

describe('equipmentGearElements', () => {
  it('merges content elements and conversion affixes, deduped in element order', () => {
    expect(
      equipmentGearElements(
        equipped({
          Weapon: item(waterSwordId),
          Ring: item(plainRingId, { affixIds: [ofFlameId] }),
          Armor: item(felArmorId, { affixIds: [ofFlameId] }),
        }),
      ),
    ).toEqual(['Fire', 'Water']);
  });

  it('is empty with no elemental gear', () => {
    expect(
      equipmentGearElements(equipped({ Ring: item(plainRingId) })),
    ).toEqual([]);
  });
});
