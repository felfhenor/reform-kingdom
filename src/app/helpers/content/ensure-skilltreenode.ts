import { ensureHeroEffect } from '@helpers/content/ensure-affix';
import { VALID_SKILL_TREE_ROWS } from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import {
  SkillTreeNodeEffectKinds,
  type JobId,
  type SkillTreeNodeContent,
  type SkillTreeNodeEffect,
  type SkillTreeNodeId,
  type SkillTreeRow,
} from '@interfaces';

function isSkillTreeNodeEffect(effect: {
  kind: string;
}): effect is SkillTreeNodeEffect {
  return SkillTreeNodeEffectKinds.includes(
    effect.kind as SkillTreeNodeEffect['kind'],
  );
}

export function ensureSkillTreeNode(
  node: Partial<SkillTreeNodeContent>,
): Required<SkillTreeNodeContent> {
  return {
    id: node.id ?? ('UNKNOWN' as SkillTreeNodeId),
    name: node.name ?? 'UNKNOWN',
    __type: 'skilltreenode',
    description: node.description ?? '',
    jobId: node.jobId ?? ('UNKNOWN' as JobId),
    level: node.level ?? 0,
    row: ensureEnumValue<SkillTreeRow | ''>(
      node.row,
      VALID_SKILL_TREE_ROWS,
      '',
    ),
    track: node.track ?? 0,
    requiredSkillTreeNodeIds: node.requiredSkillTreeNodeIds ?? [],
    optionSkillTreeNodeIds: node.optionSkillTreeNodeIds ?? [],
    default: node.default ?? false,
    specIcon: node.specIcon ?? '',
    effects: ensureArray(
      (node.effects ?? []).filter(isSkillTreeNodeEffect),
      ensureHeroEffect,
    ).filter(isSkillTreeNodeEffect),
  };
}
