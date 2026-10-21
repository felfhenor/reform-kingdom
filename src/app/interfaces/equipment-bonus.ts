import type { CombatStatBlock } from '@interfaces/combat';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { MonsterType } from '@interfaces/content-monster';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { ElementBlock } from '@interfaces/element';
import type { HeroEffect } from '@interfaces/hero-effect';
import type { StatBlock } from '@interfaces/stat';

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

export type EffectStatSummary = {
  stats: StatBlock;
  resistances: StatusEffectBlock;
  combatStats: CombatStatBlock;
  monsterTypeDamage: Record<MonsterType, number>;
  elementalResistances: ElementBlock;
  elementalBoons: ElementBlock;
};
