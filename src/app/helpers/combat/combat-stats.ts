import { defaultCombatStats } from '@helpers/defaults';
import { characterJobAbilityValue } from '@helpers/hero/job-ability';
import { skillEpCost } from '@helpers/hero/skill';
import { characterCombatStatBonusTotals } from '@helpers/item/equipment';
import { rngSucceedsChance } from '@helpers/rng';
import type { Character } from '@interfaces/character';
import type {
  Combatant,
  CombatStat,
  CombatStatBlock,
} from '@interfaces/combat';
import type { JobAbilityType } from '@interfaces/content-jobability';
import type { EquipmentSkill } from '@interfaces/content-skill';
import { isNumber } from 'es-toolkit/compat';

const JOB_ABILITY_COMBAT_STATS: Partial<Record<JobAbilityType, CombatStat>> = {
  SkillRepeatChance: 'skillStrikeAgainChance',
  CoverThreshold: 'coverThreshold',
};

// Applied once at combat creation - gear, teaching and job-ability combat-stat bonuses are
// added to the hero's base value for the whole encounter.
export function combatStatsForCharacter(character: Character): CombatStatBlock {
  const stats = defaultCombatStats();
  const bonus = characterCombatStatBonusTotals(character);

  (Object.keys(stats) as Array<keyof CombatStatBlock>).forEach((stat) => {
    stats[stat] += bonus[stat];
  });

  Object.entries(JOB_ABILITY_COMBAT_STATS).forEach(([type, stat]) => {
    stats[stat] += characterJobAbilityValue(character, type as JobAbilityType);
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

// Combats saved before this stat existed have no value for it.
export function combatCombatantSkillEpCost(
  combatant: Combatant,
  skill: EquipmentSkill,
): number {
  const increase = combatant.combatStats.epCostIncreasePercent;
  const baseCost = skillEpCost(skill);
  if (!isNumber(increase)) return baseCost;

  return Math.ceil((baseCost * (100 + increase)) / 100);
}
