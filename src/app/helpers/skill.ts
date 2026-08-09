import type {
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillTechniqueStatusEffectApplication,
} from '@interfaces/content-skill';
import type { GameElement } from '@interfaces/element';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { GameStat } from '@interfaces/stat';
import { clamp, intersection, uniq } from 'es-toolkit/compat';

// Heroes need one of a skill's `requiredWeaponTypes` equipped to use it -
// e.g. Snipe requires a Bow. An empty list means no weapon is required.
// Monsters never carry equipment, so this check only applies to heroes.
export function skillIsUsableWithEquippedWeapons(
  skill: EquipmentSkill,
  equippedWeaponTypes: EquipmentItemType[],
): boolean {
  if (skill.requiredWeaponTypes.length === 0) return true;
  return skill.requiredWeaponTypes.some((type) =>
    equippedWeaponTypes.includes(type),
  );
}

export function skillUses(skill: EquipmentSkill): number {
  return skill.usesPerCombat + (skill.mods?.usesPerCombat ?? 0);
}

export function skillEpCost(skill: EquipmentSkill): number {
  return skill.epCost + (skill.mods?.epCost ?? 0);
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

const ROMAN_NUMERAL_TIERS: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

// Splits a skill's display name into its upgrade family and rank, e.g.
// "Starshine II" -> { family: 'Starshine', tier: 2 } (matching the existing
// "Double Strike I/II" naming convention job skill paths already use). A
// name with no recognized numeral suffix is its own family at tier 1, so
// unrelated skills never compare as upgrades of one another.
function skillNameTier(name: string): { family: string; tier: number } {
  const match = name.match(/^(.*) (I{1,3}|IV|V)$/);
  if (!match) return { family: name, tier: 1 };

  return { family: match[1], tier: ROMAN_NUMERAL_TIERS[match[2]] };
}

// Slots one equipment-granted skill into a hero's known skill list: it
// replaces an already-known lower-tier skill of the same family (e.g.
// Starshine I -> II), is dropped if a same-or-higher tier is already known,
// and is otherwise appended as a newly learned skill.
function applyGrantedSkill(
  skills: EquipmentSkillContent[],
  granted: EquipmentSkillContent,
): EquipmentSkillContent[] {
  const grantedTier = skillNameTier(granted.name);
  const existingIndex = skills.findIndex(
    (skill) => skillNameTier(skill.name).family === grantedTier.family,
  );

  if (existingIndex === -1) return [...skills, granted];

  const existingTier = skillNameTier(skills[existingIndex].name);
  if (existingTier.tier >= grantedTier.tier) return skills;

  return skills.map((skill, i) => (i === existingIndex ? granted : skill));
}

// Merges equipment-granted skills into a hero's base (job-path) skills - see
// `applyGrantedSkill` for the per-skill upgrade/ignore/append rule.
export function mergeGrantedSkills(
  baseSkills: EquipmentSkillContent[],
  grantedSkills: EquipmentSkillContent[],
): EquipmentSkillContent[] {
  let merged = baseSkills;

  grantedSkills.forEach((granted) => {
    merged = applyGrantedSkill(merged, granted);
  });

  return merged;
}
