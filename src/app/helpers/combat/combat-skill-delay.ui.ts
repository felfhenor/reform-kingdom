import type { ChargingSkillPreview, Combatant } from '@interfaces';

export function combatantChargingSkillPreviews(
  combatant: Combatant,
): ChargingSkillPreview[] {
  if (combatant.hp <= 0) return [];
  return (combatant.delayedSkills ?? []).map((entry, index) => ({
    id: entry.id ?? `${entry.skill.id}:${index}`,
    skill: entry.skill,
    turnsRemaining: entry.turnsRemaining,
    caster: combatant,
  }));
}
