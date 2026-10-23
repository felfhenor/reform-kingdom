import { getEntry } from '@helpers/content/content';
import { skillTreeNodeModifiers } from '@helpers/hero/skill-modifier';
import { skillTreeIsSpecOption } from '@helpers/hero/skill-tree-content';
import type {
  EquipmentSkillContent,
  JobAbilityContent,
  SkillTreeNodeContent,
  SkillTreeNodeKind,
} from '@interfaces';

export function skillTreeNodeSkill(
  node: SkillTreeNodeContent,
): EquipmentSkillContent | undefined {
  const effect = node.effects.find((entry) => entry.kind === 'GrantSkill');
  return effect?.kind === 'GrantSkill'
    ? getEntry<EquipmentSkillContent>(effect.skillId)
    : undefined;
}

export function skillTreeNodeAbility(
  node: SkillTreeNodeContent,
): JobAbilityContent | undefined {
  const effect = node.effects.find((entry) => entry.kind === 'JobAbility');
  return effect?.kind === 'JobAbility'
    ? getEntry<JobAbilityContent>(effect.jobAbilityId)
    : undefined;
}

export function skillTreeNodeKind(
  node: SkillTreeNodeContent,
): SkillTreeNodeKind {
  const skillData = skillTreeNodeSkill(node);
  if (skillData) {
    if (skillData.special) return 'Burst Skill';
    return 'Skill';
  }
  if (skillTreeNodeAbility(node)) return 'Job Ability';
  if (skillTreeNodeModifiers(node).length > 0) return 'Skill Modifier';
  return skillTreeIsSpecOption(node) ? 'Specialization' : 'Perk';
}
