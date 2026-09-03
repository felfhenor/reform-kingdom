import {
  ensureCombatStats,
  ensureStats,
  ensureTagResistances,
} from '@helpers/content/ensure-helpers-stats';
import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
} from '@interfaces';

export function ensureCollectible(
  collectible: Partial<CollectibleContent>,
): Required<CollectibleContent> {
  return {
    id: collectible.id ?? ('UNKNOWN' as CollectibleId),
    name: collectible.name ?? 'UNKNOWN',
    __type: 'collectible',
    description: collectible.description ?? 'UNKNOWN',
    sprite: collectible.sprite ?? 'UNKNOWN',
    rarity: collectible.rarity ?? 'Common',
    unobtainable: collectible.unobtainable ?? false,
  };
}

export function ensureEquipment(
  equipment: Partial<EquipmentContent>,
): Required<EquipmentContent> {
  return {
    id: equipment.id ?? ('UNKNOWN' as EquipmentId),
    name: equipment.name ?? 'UNKNOWN',
    __type: 'equipment',
    levelRequirement: equipment.levelRequirement ?? 1,
    rarity: equipment.rarity ?? 'Common',
    description: equipment.description ?? 'UNKNOWN',
    baseStats: ensureStats(equipment.baseStats),
    debuffResistances: ensureTagResistances(equipment.debuffResistances),
    combatStats: ensureCombatStats(equipment.combatStats),
    sprite: equipment.sprite ?? 'UNKNOWN',
    type: equipment.type ?? 'Accessory',
    // Defaults to 0, not 1 - infusion slots must always be explicitly
    // opted into at the data level. This fallback only guards against
    // malformed/legacy entries, it does not grant free slots.
    slots: equipment.slots ?? 0,
    grantedSkillIds: equipment.grantedSkillIds ?? [],
    unobtainable: equipment.unobtainable ?? false,
  };
}

export function ensureItem(item: Partial<ItemContent>): Required<ItemContent> {
  return {
    id: item.id ?? ('UNKNOWN' as ItemId),
    name: item.name ?? 'UNKNOWN',
    __type: 'item',
    rarity: item.rarity ?? 'Common',
    description: item.description ?? 'UNKNOWN',
    sprite: item.sprite ?? 'UNKNOWN',
    infusionStats: ensureStats(item.infusionStats),
    infusionDebuffResistances: ensureTagResistances(
      item.infusionDebuffResistances,
    ),
    infusionCombatStats: ensureCombatStats(item.infusionCombatStats),
    unobtainable: item.unobtainable ?? false,
  };
}
