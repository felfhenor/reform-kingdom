import {
  combatDamageElements,
  getCombatantBaseDamageForTechnique,
  techniqueHasAttribute,
} from '@helpers/combat/combat-damage';
import { elementalBoonMultiplier } from '@helpers/combat/combat-element';
import { combatFormatMessage } from '@helpers/combat/combat-log';
import { SKILL_MAX_ALLY_TARGETS } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  skillTechniqueNumTargets,
  skillTechniqueStatScaling,
  skillTechniqueStatusEffectChance,
  skillTechniqueStatusEffectDuration,
  skillTechniqueWithStatBonuses,
} from '@helpers/hero/skill';
import type {
  Combatant,
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillTargetBehaviorData,
  MonsterContent,
  SkillTechniqueKind,
  SkillTechniquePreview,
  SkillTechniqueStatusPreview,
  SkillTechniqueTargeting,
  StatusEffectContent,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Mirrors the live combat formula but skips target-side mitigation (no target chosen yet); for tooltip previews only.
export function skillTechniquePreviewValue(
  combatant: Combatant,
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): number {
  const total =
    getCombatantBaseDamageForTechnique(combatant, skill, technique) *
    elementalBoonMultiplier(
      combatant,
      combatDamageElements(combatant, technique),
    );

  return Math.max(0, Math.floor(total));
}

// Combat treats non-zero damageScaling as damage unless HealsTarget flips the sign.
export function skillTechniqueKind(
  technique: EquipmentSkillContentTechnique,
): SkillTechniqueKind {
  const scales = skillTechniqueStatScaling(technique).length > 0;

  if (technique.summonMonsterId) return 'Summon';
  if (techniqueHasAttribute(technique, 'HealsTarget')) return 'Heal';
  if (techniqueHasAttribute(technique, 'RestoresTargetEnergy'))
    return 'Restore';
  if (techniqueHasAttribute(technique, 'DamagesTarget') || scales) {
    return 'Damage';
  }
  if (techniqueHasAttribute(technique, 'Buff')) return 'Buff';
  if (techniqueHasAttribute(technique, 'Debuff')) return 'Debuff';
  return 'Effect';
}

export function skillTechniqueTargeting(
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): SkillTechniqueTargeting {
  const count = skillTechniqueNumTargets(skill, technique);

  switch (technique.targetType) {
    case 'Self':
      return { noun: 'self' };
    case 'All':
      return { noun: 'all combatants' };
    case 'Allies':
      if (count >= SKILL_MAX_ALLY_TARGETS) return { noun: 'all allies' };
      return { count, noun: count === 1 ? 'ally' : 'allies' };
    default:
      return { count, noun: count === 1 ? 'enemy' : 'enemies' };
  }
}

function skillTargetBehaviorCondition(
  behavior: EquipmentSkillTargetBehaviorData,
): string[] {
  const effectName = () =>
    getEntry<StatusEffectContent>(behavior.statusEffectId ?? '')?.name ??
    'a status effect';

  switch (behavior.behavior) {
    case 'NotMaxHealth':
      return ['Only if wounded'];
    case 'NotMaxEnergy':
      return ['Only if missing EP'];
    case 'IfStatusEffect':
      return [`Only if it has ${effectName()}`];
    case 'IfNotStatusEffect':
      return [`Only if it lacks ${effectName()}`];
    case 'IfNoSummon':
      return ['Only if no summon is active'];
    default:
      return [];
  }
}

function skillTechniqueStatusPreviews(
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): SkillTechniqueStatusPreview[] {
  return technique.statusEffects.map((application) => ({
    name:
      getEntry<StatusEffectContent>(application.statusEffectId)?.name ??
      'Unknown effect',
    chance: skillTechniqueStatusEffectChance(skill, application),
    duration: skillTechniqueStatusEffectDuration(skill, application),
  }));
}

function skillTechniquePreview(
  combatant: Combatant,
  skill: EquipmentSkillContent,
  technique: EquipmentSkillContentTechnique,
): SkillTechniquePreview {
  const kind = skillTechniqueKind(technique);
  const damageElements = combatDamageElements(combatant, technique);
  const hasAmount = kind === 'Damage' || kind === 'Heal' || kind === 'Restore';

  return {
    kind,
    amount: hasAmount
      ? skillTechniquePreviewValue(combatant, skill, technique)
      : 0,
    targeting: skillTechniqueTargeting(skill, technique),
    conditions: technique.targetBehaviors.flatMap(skillTargetBehaviorCondition),
    scaling: skillTechniqueStatScaling(
      skillTechniqueWithStatBonuses(
        skill,
        technique,
        combatant.skillStatBonuses,
      ),
    ),
    elements: damageElements.length > 0 ? damageElements : technique.elements,
    statusEffects: skillTechniqueStatusPreviews(skill, technique),
    accuracy: techniqueHasAttribute(technique, 'NeverMisses')
      ? 100
      : technique.accuracy,
    summonName: technique.summonMonsterId
      ? getEntry<MonsterContent>(technique.summonMonsterId)?.name
      : undefined,
  };
}

export function skillTechniquePreviews(
  combatant: Combatant,
  skill: EquipmentSkillContent,
): SkillTechniquePreview[] {
  return skill.techniques.map((technique) =>
    skillTechniquePreview(combatant, skill, technique),
  );
}

// Damage total, or heal total for pure-heal skills - never both summed.
function skillDescriptionValue(
  combatant: Combatant,
  skill: EquipmentSkillContent,
): number {
  const kinds = skill.techniques.map(skillTechniqueKind);
  let valuedKind = '';

  if (kinds.includes('Heal')) valuedKind = 'Heal';
  if (kinds.includes('Damage')) valuedKind = 'Damage';
  if (kinds.includes('Restore')) valuedKind = 'Restore';

  return sumBy(skill.techniques, (technique) =>
    skillTechniqueKind(technique) === valuedKind
      ? skillTechniquePreviewValue(combatant, skill, technique)
      : 0,
  );
}

export function skillDescriptionWithPreview(
  combatant: Combatant,
  skill: EquipmentSkillContent,
): string {
  if (skill.techniques.length === 0) return skill.description;

  return combatFormatMessage(skill.description, {
    value: skillDescriptionValue(combatant, skill),
  });
}
