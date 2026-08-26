import type {
  EquipmentSkill,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillTechniqueStatusEffectApplication,
} from '@interfaces/content-skill';
import type { GameElement } from '@interfaces/element';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { GameStat, SkillStatScaling, StatBlock } from '@interfaces/stat';
import { StatOrder } from '@interfaces/stat';
import { clamp, uniq } from 'es-toolkit/compat';

// Heroes need one of requiredWeaponTypes equipped (empty = no requirement); monsters never carry equipment.
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

// Which stats a skill's damage/healing scales from and by how much; multi-technique skills sum multipliers across techniques.
export function skillStatScaling(
  skill: EquipmentSkillContent,
): SkillStatScaling[] {
  const totals = {} as StatBlock;

  skill.techniques.forEach((technique) => {
    (Object.keys(technique.damageScaling) as GameStat[]).forEach((stat) => {
      totals[stat] = (totals[stat] ?? 0) + technique.damageScaling[stat];
    });
  });

  return StatOrder.filter((stat) => totals[stat]).map((stat) => ({
    stat,
    multiplier: totals[stat],
  }));
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

// Splits a display name into upgrade family and rank, e.g. "Starshine II" -> { family: 'Starshine', tier: 2 }.
function skillNameTier(name: string): { family: string; tier: number } {
  const match = name.match(/^(.*) (I{1,3}|IV|V)$/);
  if (!match) return { family: name, tier: 1 };

  return { family: match[1], tier: ROMAN_NUMERAL_TIERS[match[2]] };
}

// Upgrades a known same-family skill to the granted tier, drops it if a same-or-higher tier is already known, else appends.
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
