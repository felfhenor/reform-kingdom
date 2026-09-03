import {
  VALID_EQUIPMENT_ITEM_TYPES,
  VALID_GAME_ELEMENTS,
  VALID_SKILL_ATTRIBUTES,
  VALID_SKILL_TARGET_BEHAVIORS,
  VALID_SKILL_TARGET_TYPES,
} from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import type {
  EquipmentSkillContent,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  EquipmentSkillTargetBehaviorData,
  EquipmentSkillTechniqueStatusEffectApplication,
  StatusEffectId,
} from '../../interfaces';

function ensureEquipmentSkillTargetBehaviorData(
  behavior: Partial<EquipmentSkillTargetBehaviorData> = {},
): EquipmentSkillTargetBehaviorData {
  return {
    behavior: ensureEnumValue(
      behavior.behavior,
      VALID_SKILL_TARGET_BEHAVIORS,
      'Always',
    ),
    statusEffectId: behavior.statusEffectId,
  };
}

function ensureEquipmentSkillTechniqueStatusEffectApplication(
  effect: Partial<EquipmentSkillTechniqueStatusEffectApplication> = {},
): EquipmentSkillTechniqueStatusEffectApplication {
  return {
    statusEffectId: effect.statusEffectId ?? ('UNKNOWN' as StatusEffectId),
    chance: effect.chance ?? 0,
    duration: effect.duration ?? 1,
  };
}

function ensureEquipmentSkillTechnique(
  technique: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: technique.targets ?? 1,
    targetType: ensureEnumValue(
      technique.targetType,
      VALID_SKILL_TARGET_TYPES,
      'Enemies',
    ),
    targetBehaviors: ensureArray(
      technique.targetBehaviors,
      ensureEquipmentSkillTargetBehaviorData,
    ),
    damageScaling: ensureStats(technique.damageScaling),
    elements: ensureEnumArray(technique.elements, VALID_GAME_ELEMENTS),
    attributes: ensureEnumArray(technique.attributes, VALID_SKILL_ATTRIBUTES),
    statusEffects: ensureArray(
      technique.statusEffects,
      ensureEquipmentSkillTechniqueStatusEffectApplication,
    ),
    combatMessage: technique.combatMessage ?? 'UNKNOWN',
  };
}

export function ensureSkill(
  skill: Partial<EquipmentSkillContent>,
): Required<EquipmentSkillContent> {
  return {
    id: skill.id ?? ('UNKNOWN' as EquipmentSkillId),
    name: skill.name ?? 'UNKNOWN',
    __type: 'skill',
    description: skill.description ?? 'UNKNOWN',
    sprite: skill.sprite ?? 'UNKNOWN',
    rarity: skill.rarity ?? 'Common',
    techniques: ensureArray(skill.techniques, ensureEquipmentSkillTechnique),
    usesPerCombat: skill.usesPerCombat ?? -1,
    epCost: skill.epCost ?? 0,
    statusEffectDurationBoost: skill.statusEffectDurationBoost ?? {},
    statusEffectChanceBoost: skill.statusEffectChanceBoost ?? {},
    requiredWeaponTypes: ensureEnumArray(
      skill.requiredWeaponTypes,
      VALID_EQUIPMENT_ITEM_TYPES,
    ),
    family: skill.family ?? 'UNKNOWN',
  };
}
