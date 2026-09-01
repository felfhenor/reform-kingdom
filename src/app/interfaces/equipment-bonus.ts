import type { AffixEffect } from '@interfaces/content-affix';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';

// One config per "equipment bonus dimension" (base stats, resistances,
// combat stats, ...) - see the STAT_BONUS/RESISTANCE_BONUS/COMBAT_STAT_BONUS
// constants and the generic sum functions in `helpers/item/equipment-bonus.ts`.
export type EquipmentBonusDimension<K extends string> = {
  defaultBlock: () => Record<K, number>;
  equipmentBlock: (
    content: EquipmentContent,
  ) => Partial<Record<K, number>> | undefined;
  infusionBlock: (
    content: ItemContent,
  ) => Partial<Record<K, number>> | undefined;
  affixBonusFor: (affixEffects: AffixEffect[], key: K) => number;
};
