import { getCombatantBaseStatDamageForTechnique } from '@helpers/combat/combat-damage';
import { combatFormatMessage } from '@helpers/combat/combat-log';
import type {
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  GameStat,
} from '@interfaces';
import { sum, sumBy } from 'es-toolkit/compat';

// Mirrors the live combat formula but skips target-side mitigation (no target chosen yet); for tooltip previews only.
export function skillTechniquePreviewValue(
  combatant: Combatant,
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): number {
  const total = sum(
    (Object.keys(technique.damageScaling) as GameStat[]).map((stat) =>
      getCombatantBaseStatDamageForTechnique(combatant, skill, technique, stat),
    ),
  );

  return Math.max(0, Math.floor(total));
}

// Substitutes the `{{ value }}` placeholder with the skill's previewed heal/damage.
export function skillDescriptionWithPreview(
  combatant: Combatant,
  skill: EquipmentSkillContent,
): string {
  const techniques = skill.techniques;
  if (techniques.length === 0) return skill.description;

  const value = sumBy(techniques, (technique) =>
    skillTechniquePreviewValue(combatant, skill, technique),
  );

  return combatFormatMessage(skill.description, { value });
}
