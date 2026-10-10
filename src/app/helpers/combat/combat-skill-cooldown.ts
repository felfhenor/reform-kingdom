import { skillCooldown } from '@helpers/hero/skill';
import type { Combatant, EquipmentSkill } from '@interfaces';

export function combatantTickSkillCooldowns(combatant: Combatant): void {
  const cooldowns = combatant.skillCooldowns;
  if (!cooldowns) return;

  combatant.skillCooldowns = Object.fromEntries(
    Object.entries(cooldowns)
      .map(([id, turns]) => [id, turns - 1] as const)
      .filter(([, turns]) => turns > 0),
  );
}

// +1 because the tick at the start of the next turn runs before the skill is picked.
export function combatantStartSkillCooldown(
  combatant: Combatant,
  skill: EquipmentSkill,
): void {
  const cooldown = skillCooldown(skill);
  if (cooldown <= 0) return;

  combatant.skillCooldowns ??= {};
  combatant.skillCooldowns[skill.id] = cooldown + 1;
}

export function combatantSkillOnCooldown(
  combatant: Combatant,
  skill: EquipmentSkill,
): boolean {
  return (combatant.skillCooldowns?.[skill.id] ?? 0) > 0;
}

export function combatantSkillCooldownRemaining(
  combatant: Combatant,
  skill: EquipmentSkill,
): number {
  return Math.max(0, (combatant.skillCooldowns?.[skill.id] ?? 0) - 1);
}
