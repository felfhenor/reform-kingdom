import { defaultCombatStats } from '@helpers/defaults';
import { characterCombatStatBonusTotals } from '@helpers/item/equipment';
import { rngSucceedsChance } from '@helpers/rng';
import type { Character } from '@interfaces/character';
import type { Combatant, CombatStatBlock } from '@interfaces/combat';

// Applied once at combat creation - gear and teaching combat-stat bonuses are
// added to the hero's base value for the whole encounter.
export function combatStatsForCharacter(character: Character): CombatStatBlock {
  const stats = defaultCombatStats();
  const bonus = characterCombatStatBonusTotals(character);

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
