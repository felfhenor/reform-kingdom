import { getCombatantBaseStatDamageForTechnique } from '@helpers/combat-damage';
import { combatFormatMessage } from '@helpers/combat-log';
import type {
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  GameStat,
} from '@interfaces';
import { sum, sumBy } from 'es-toolkit/compat';

// Estimates a technique's outgoing heal/damage from the combatant's current
// stats - mirrors the live combat formula but skips target-side mitigation
// (defense, crits, luck) since no target is chosen yet. Used to preview a
// skill's power in tooltips, not to deal real damage. Takes a `Combatant`
// rather than a `Character`/`MonsterContent` directly so the same preview
// works for both heroes (`combatantFromCharacter`) and monsters
// (`combatantFromMonster`).
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

// Renders a skill's description, substituting a `{{ value }}` placeholder
// with its previewed heal/damage - skills currently always have a single
// technique, so the description maps 1:1 to `techniques[0]`.
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
