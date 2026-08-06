import type {
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  EquipmentSkillTechniqueStatusEffectApplication,
} from '@interfaces/content-skill';
import type { GameElement } from '@interfaces/element';
import type { GameStat } from '@interfaces/stat';
import { clamp, intersection, uniq } from 'es-toolkit/compat';

export function skillUses(skill: EquipmentSkill): number {
  return skill.usesPerCombat + (skill.mods?.usesPerCombat ?? 0);
}

export function skillTechniqueNumTargets(
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): number {
  const numTargets = technique.targets;
  if (technique.targetType === 'Self') return 1;
  if (technique.targetType === 'Allies') return clamp(numTargets, 1, 4);
  return numTargets;
}

export function skillTechniqueDamageScalingStat(
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
  stat: GameStat,
): number {
  return technique.damageScaling[stat];
}

export function skillTechniqueStatusEffectChance(
  skill: EquipmentSkill,
  techniqueApplication: EquipmentSkillTechniqueStatusEffectApplication,
): number {
  return (
    techniqueApplication.chance +
    (skill.mods?.statusEffectChanceBoost?.[
      techniqueApplication.statusEffectId
    ] ?? 0)
  );
}

export function skillTechniqueStatusEffectDuration(
  skill: EquipmentSkill,
  techniqueApplication: EquipmentSkillTechniqueStatusEffectApplication,
): number {
  return (
    techniqueApplication.duration +
    (skill.mods?.statusEffectDurationBoost?.[
      techniqueApplication.statusEffectId
    ] ?? 0)
  );
}

export function skillElements(skill: EquipmentSkill): GameElement[] {
  return uniq(skill.techniques.flatMap((t) => t.elements)).sort();
}

export function skillDisplayElement(skill: EquipmentSkill): string {
  const elements = skillElements(skill);

  if (intersection(elements, ['Air', 'Fire', 'Water', 'Earth']).length === 4)
    return 'Holy';

  if (intersection(elements, ['Fire', 'Water']).length === 2) return 'Steam';
  if (intersection(elements, ['Fire', 'Air']).length === 2) return 'Heat';
  if (intersection(elements, ['Fire', 'Earth']).length === 2) return 'Molten';
  if (intersection(elements, ['Water', 'Earth']).length === 2) return 'Mud';
  if (intersection(elements, ['Water', 'Air']).length === 2) return 'Mist';
  if (intersection(elements, ['Earth', 'Air']).length === 2) return 'Sand';

  if (intersection(elements, ['Fire']).length === 1) return 'Fire';
  if (intersection(elements, ['Water']).length === 1) return 'Water';
  if (intersection(elements, ['Earth']).length === 1) return 'Earth';
  if (intersection(elements, ['Air']).length === 1) return 'Air';

  return elements.join(', ');
}
