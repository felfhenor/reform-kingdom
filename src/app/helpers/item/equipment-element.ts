import {
  elementalBoonFloor,
  elementalResistanceClamp,
} from '@helpers/combat/combat-element';
import { getEntry } from '@helpers/content/content';
import {
  affixEffectsOfKind,
  equipmentItemAffixEffects,
} from '@helpers/item/affix';
import {
  equipmentDimensionTotals,
  equippedItems,
} from '@helpers/item/equipment';
import {
  affixEffectsAddToBlock,
  ELEMENT_BOON_BONUS,
  ELEMENT_RESISTANCE_BONUS,
} from '@helpers/item/equipment-bonus';
import { characterTeachingEffects } from '@helpers/trainer/trainer-teaching';
import type {
  Character,
  ElementBlock,
  EquipmentBlock,
  EquipmentBonusDimension,
  EquipmentContent,
  EquipmentItem,
  GameElement,
} from '@interfaces';
import { GameElementOrder } from '@interfaces';

function characterElementBlock(
  character: Character,
  dimension: EquipmentBonusDimension<GameElement>,
): ElementBlock {
  return affixEffectsAddToBlock(
    equipmentDimensionTotals(character.equipment, dimension),
    characterTeachingEffects(character),
    dimension,
  );
}

// Clamped here so the stat panel shows exactly what combat uses.
export function characterElementalResistances(
  character: Character,
): ElementBlock {
  return elementalResistanceClamp(
    characterElementBlock(character, ELEMENT_RESISTANCE_BONUS),
  );
}

export function characterElementalBoons(character: Character): ElementBlock {
  return elementalBoonFloor(
    characterElementBlock(character, ELEMENT_BOON_BONUS),
  );
}

function equipmentItemGearElements(item: EquipmentItem): GameElement[] {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  const converted = affixEffectsOfKind(
    equipmentItemAffixEffects(item),
    'ElementConversion',
  ).map((effect) => effect.element);

  return [...(content?.elements ?? []), ...converted];
}

export function equipmentGearElements(
  equipment: EquipmentBlock,
): GameElement[] {
  const elements = new Set(
    equippedItems(equipment).flatMap(equipmentItemGearElements),
  );
  return GameElementOrder.filter((element) => elements.has(element));
}
