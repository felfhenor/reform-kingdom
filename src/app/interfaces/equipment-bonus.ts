import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { HeroEffect } from '@interfaces/hero-effect';

// One config per "equipment bonus dimension" (base stats, resistances,
// combat stats, ...).
export type EquipmentBonusDimension<K extends string> = {
  defaultBlock: () => Record<K, number>;
  equipmentBlock: (
    content: EquipmentContent,
  ) => Partial<Record<K, number>> | undefined;
  infusionBlock: (
    content: ItemContent,
  ) => Partial<Record<K, number>> | undefined;
  affixBonusFor: (affixEffects: HeroEffect[], key: K) => number;
};
