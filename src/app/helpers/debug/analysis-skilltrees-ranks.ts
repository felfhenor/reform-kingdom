// Rank chains in a skill tree: each skill tier and job ability rank should build on the one below.

import { getEntry } from '@helpers/content/content';
import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import { skillNameTier } from '@helpers/hero/skill';
import {
  skillTreeNodeHasAncestor,
  skillTreeNodeLevel,
} from '@helpers/hero/skill-tree-content';
import type {
  AnalysisIssue,
  EquipmentSkillContent,
  JobAbilityContent,
  SkillTreeNodeContent,
} from '@interfaces';
import { groupBy, sortBy } from 'es-toolkit/compat';

export function skillTreeGrantedSkills(
  nodes: SkillTreeNodeContent[],
): EquipmentSkillContent[] {
  return nodes
    .flatMap((node) => node.effects)
    .flatMap((effect) => (effect.kind === 'GrantSkill' ? [effect.skillId] : []))
    .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
    .filter((skill): skill is EquipmentSkillContent => !!skill);
}

// A node granting a skill tier should require the node granting the tier below.
function skillTierWarnings(nodes: SkillTreeNodeContent[]): AnalysisIssue[] {
  const grants = nodes.flatMap((node) =>
    skillTreeGrantedSkills([node]).map((skill) => ({
      node,
      ...skillNameTier(skill.name),
    })),
  );

  return grants.flatMap((grant) => {
    const below = grants.find(
      (other) => other.family === grant.family && other.tier === grant.tier - 1,
    );
    return below && !grant.node.requiredSkillTreeNodeIds.includes(below.node.id)
      ? [
          analysisWarn(
            `${grant.node.name}: does not require ${below.node.name}.`,
          ),
        ]
      : [];
  });
}

function abilityRankNodes(
  nodes: SkillTreeNodeContent[],
): SkillTreeNodeContent[][] {
  const byAbility = groupBy(
    nodes.filter((node) =>
      node.effects.some((effect) => effect.kind === 'JobAbility'),
    ),
    (node) =>
      node.effects.flatMap((effect) =>
        effect.kind === 'JobAbility'
          ? [getEntry<JobAbilityContent>(effect.jobAbilityId)?.id ?? '']
          : [],
      )[0],
  );

  return Object.values(byAbility).map((ranks) =>
    sortBy(ranks, (node) => skillTreeNodeLevel(nodes, node)),
  );
}

// Ability rows assume ranks are learned in order, so each rank must build on the one below.
function abilityRankIssues(nodes: SkillTreeNodeContent[]): AnalysisIssue[] {
  return abilityRankNodes(nodes).flatMap((ranks) =>
    ranks
      .slice(1)
      .flatMap((rank, i) =>
        skillTreeNodeHasAncestor(nodes, rank, ranks[i].id)
          ? []
          : [analysisFail(`${rank.name}: does not build on ${ranks[i].name}.`)],
      ),
  );
}

export function skillTreeRankIssues(
  nodes: SkillTreeNodeContent[],
): AnalysisIssue[] {
  return [...skillTierWarnings(nodes), ...abilityRankIssues(nodes)];
}
