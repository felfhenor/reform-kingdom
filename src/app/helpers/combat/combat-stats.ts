import { defaultCombatStats } from '@helpers/defaults';
import { equipmentCombatStatTotals } from '@helpers/item/equipment';
import { rngSucceedsChance } from '@helpers/rng';
import type { Combatant, CombatStatBlock } from '@interfaces/combat';
import type { EquipmentBlock } from '@interfaces/equipment';

// Applied once at combat creation - gear's combat-stat bonuses are added to
// the wearer's base value for the whole encounter.
export function combatStatsForCharacterEquipment(
  equipment: EquipmentBlock,
): CombatStatBlock {
  const stats = defaultCombatStats();
  const bonus = equipmentCombatStatTotals(equipment);

  (Object.keys(stats) as Array<keyof CombatStatBlock>).forEach((stat) => {
    stats[stat] += bonus[stat];
  });

  return stats;
}

export function combatCombatantCombatStatValue(
  combatant: Combatant,
  stat: keyof CombatStatBlock,
) {
  return combatant.combatStats[stat];
}

export function combatCombatantCombatStatSucceedsChance(
  combatant: Combatant,
  stat: keyof CombatStatBlock,
) {
  return rngSucceedsChance(combatant.combatStats[stat]);
}
