import { combatDamageElements } from '@helpers/combat/combat-damage';
import { elementalDamageMultiplier } from '@helpers/combat/combat-element';
import type { Combatant, ElementVerdict, EquipmentSkill } from '@interfaces';
import { mean } from 'es-toolkit/compat';

// Same multiplier the damage formula uses, so attacker boons and weapon elements count.
export function skillElementVerdict(
  attacker: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
): ElementVerdict | undefined {
  const multipliers = skill.techniques
    .map((technique) => combatDamageElements(attacker, technique))
    .filter((elements) => elements.length > 0)
    .map((elements) => elementalDamageMultiplier(attacker, target, elements));
  if (multipliers.length === 0) return undefined;

  // Whole percents, so float drift on an even mix doesn't read as a lean.
  const percent = Math.round(mean(multipliers) * 100);
  if (percent > 100) return 'Weak';
  if (percent < 100) return 'Resist';
  return undefined;
}
