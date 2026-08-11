import { combatantFromCharacter } from '@helpers/combat-create';
import { getCombatantBaseStatDamageForTechnique } from '@helpers/combat-damage';
import { combatFormatMessage } from '@helpers/combat-log';
import type {
  Character,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  GameStat,
} from '@interfaces';
import { sum, sumBy } from 'es-toolkit/compat';

// Estimates a technique's outgoing heal/damage from the hero's current
// stats and equipment - mirrors the live combat formula but skips
// target-side mitigation (defense, crits, luck) since no target is chosen
// yet. Used to preview a skill's power in tooltips, not to deal real damage.
export function skillTechniquePreviewValue(
  character: Character,
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): number {
  const combatant = combatantFromCharacter(character);

  const total = sum(
    (Object.keys(technique.damageScaling) as GameStat[]).map((stat) =>
      getCombatantBaseStatDamageForTechnique(combatant, skill, technique, stat),
    ),
  );

  return Math.max(0, Math.floor(total));
}

// Renders a skill's description, substituting a `{{ value }}` placeholder
// with its previewed heal/damage - skills currently always have a single
// technique, so the description maps 1:1 to `techniques[0]`.
export function skillDescriptionWithPreview(
  character: Character,
  skill: EquipmentSkillContent,
): string {
  const techniques = skill.techniques;
  if (techniques.length === 0) return skill.description;

  const value = sumBy(techniques, (technique) =>
    skillTechniquePreviewValue(character, skill, technique),
  );

  return combatFormatMessage(skill.description, { value });
}
