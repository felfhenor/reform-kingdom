import { rngSucceedsChance } from '@helpers/rng';
import type { Combatant, CombatantCombatStats } from '@interfaces/combat';

export function combatCombatantCombatStatValue(
  combatant: Combatant,
  stat: keyof CombatantCombatStats,
) {
  return combatant.combatStats[stat];
}

export function combatCombatantCombatStatSucceedsChance(
  combatant: Combatant,
  stat: keyof CombatantCombatStats,
) {
  return rngSucceedsChance(combatant.combatStats[stat]);
}
