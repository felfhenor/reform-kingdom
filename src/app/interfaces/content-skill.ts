import type { HasAnimation } from '@interfaces/artable';
import type { StatusEffectId } from '@interfaces/content-statuseffect';
import type { HasRarity } from '@interfaces/droppable';
import type { GameElement } from '@interfaces/element';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type SkillId = Branded<string, 'SkillId'>;

export type SkillContent = IsContentItem &
  HasDescription & {
    id: SkillId;
  };

export type EquipmentSkillTargetBehavior =
  | 'Always'
  | 'NotZeroHealth'
  | 'NotMaxHealth'
  | 'IfStatusEffect'
  | 'IfNotStatusEffect';

export type EquipmentSkillAttribute =
  | 'BypassDefense'
  | 'DamagesTarget'
  | 'AllowPlink'
  | 'HealsTarget'
  | 'Buff'
  | 'Debuff';

export type EquipmentSkillTargetType = 'Allies' | 'Enemies' | 'Self' | 'All';

export type EquipmentSkillId = Branded<string, 'EquipmentSkillId'>;

export type EquipmentSkillContentModifiable = {
  techniques: EquipmentSkillContentTechnique[];
  usesPerCombat: -1 | number;
  numTargets: number;
  damageScaling: StatBlock;
  statusEffectDurationBoost: Record<StatusEffectId, number>;
  statusEffectChanceBoost: Record<StatusEffectId, number>;
};

export type EquipmentSkillTargetBehaviorData = {
  behavior: EquipmentSkillTargetBehavior;

  statusEffectId?: StatusEffectId;
};

export type EquipmentSkillTechniqueStatusEffectApplication = {
  statusEffectId: StatusEffectId;
  chance: number;
  duration: number;
};

export type EquipmentSkillContentTechnique = {
  targets: number;
  targetType: EquipmentSkillTargetType;
  targetBehaviors: EquipmentSkillTargetBehaviorData[];
  damageScaling: StatBlock;
  elements: GameElement[];
  attributes: EquipmentSkillAttribute[];
  statusEffects: EquipmentSkillTechniqueStatusEffectApplication[];

  combatMessage: string;
};

export type EquipmentSkillContent = IsContentItem &
  HasAnimation &
  HasRarity &
  EquipmentSkillContentModifiable &
  HasDescription & {
    __type: 'skill';
    id: EquipmentSkillId;
  };

export type EquipmentSkill = EquipmentSkillContent & {
  mods?: Partial<EquipmentSkillContentModifiable>;
};
