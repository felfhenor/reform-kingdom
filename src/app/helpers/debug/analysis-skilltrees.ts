// Audits skill trees: node placement, requirements, oaths, the spec oath, effect references, skill modifiers and default nodes.

import {
  SKILL_TREE_MAX_BASE_COLUMNS,
  SKILL_TREE_MAX_TRACKS,
  SKILL_TREE_SPEC_COLUMNS,
  SKILL_TREE_SPEC_OATH_LEVEL,
  SKILL_TREE_STARTING_SP,
} from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  analysisFail,
  analysisIssueChecks,
} from '@helpers/debug/analysis-utils';
import { skillTreeModifierIssues } from '@helpers/debug/analysis-skilltrees-modifiers';
import {
  skillTreeGrantedSkills,
  skillTreeRankIssues,
} from '@helpers/debug/analysis-skilltrees-ranks';
import {
  skillTreeIsLevelColumn,
  skillTreeIsOath,
  skillTreeIsSpecOption,
  skillTreeJobNodes,
  skillTreeNodeHasAncestor,
  skillTreeNodeLevel,
  skillTreeNodeShortName,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import type {
  AnalysisCheck,
  AnalysisIssue,
  AnalysisRunResult,
  EquipmentSkillContent,
  JobAbilityContent,
  JobContent,
  SkillTreeNodeContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function placedNodes(nodes: SkillTreeNodeContent[]): SkillTreeNodeContent[] {
  return nodes.filter((node) => !skillTreeOptionOath(nodes, node.id));
}

function placementIssues(
  job: JobContent,
  node: SkillTreeNodeContent,
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const rows = [...job.treeRows, ...job.specializationRows];

  if (!skillTreeIsLevelColumn(node.level)) {
    issues.push(
      analysisFail(`${node.name}: level ${node.level} is not a column.`),
    );
  }
  if (node.row === '' || !rows.includes(node.row)) {
    issues.push(
      analysisFail(`${node.name}: row "${node.row}" is not a job row.`),
    );
  }
  if (node.track < 0 || node.track >= SKILL_TREE_MAX_TRACKS) {
    issues.push(
      analysisFail(`${node.name}: track ${node.track} is out of range.`),
    );
  }

  return issues;
}

function slotIssues(placed: SkillTreeNodeContent[]): AnalysisIssue[] {
  const owners = new Map<string, string>();
  return placed.flatMap((node) => {
    const slot = `${node.row}/${node.track}/${node.level}`;
    const owner = owners.get(slot);
    owners.set(slot, node.name);
    return owner
      ? [analysisFail(`${node.name}: shares row/track/level with ${owner}.`)]
      : [];
  });
}

function requirementIssues(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
): AnalysisIssue[] {
  return node.requiredSkillTreeNodeIds.flatMap((parentId) => {
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) {
      return [
        analysisFail(`${node.name}: requires "${parentId}", not in this tree.`),
      ];
    }

    return skillTreeNodeLevel(nodes, parent) >= node.level
      ? [
          analysisFail(
            `${node.name}: parent ${parent.name} is not at a lower level.`,
          ),
        ]
      : [];
  });
}

function oathIssues(
  nodes: SkillTreeNodeContent[],
  oath: SkillTreeNodeContent,
): AnalysisIssue[] {
  if (new Set(oath.optionSkillTreeNodeIds).size !== 2) {
    return [analysisFail(`${oath.name}: an oath needs exactly 2 options.`)];
  }
  if (oath.effects.length > 0 || oath.default) {
    return [
      analysisFail(
        `${oath.name}: an oath has no effects and is never a default.`,
      ),
    ];
  }

  return oath.optionSkillTreeNodeIds.flatMap((optionId) => {
    const option = nodes.find((node) => node.id === optionId);
    if (!option) {
      return [
        analysisFail(`${oath.name}: option "${optionId}" is not in this tree.`),
      ];
    }

    const placedFields =
      option.level !== 0 ||
      option.row !== '' ||
      option.track !== 0 ||
      option.requiredSkillTreeNodeIds.length > 0;
    return placedFields
      ? [
          analysisFail(
            `${option.name}: an oath option has no level/row/track/requirements.`,
          ),
        ]
      : [];
  });
}

function sharedOptionIssues(nodes: SkillTreeNodeContent[]): AnalysisIssue[] {
  return nodes
    .filter(
      (option) =>
        nodes.filter((oath) => oath.optionSkillTreeNodeIds.includes(option.id))
          .length > 1,
    )
    .map((option) =>
      analysisFail(`${option.name}: is an option of more than one oath.`),
    );
}

// Spec-row nodes must descend from their own row's spec option.
function specLineageIssues(
  job: JobContent,
  nodes: SkillTreeNodeContent[],
): AnalysisIssue[] {
  return placedNodes(nodes)
    .filter(
      (node) =>
        node.row !== '' &&
        job.specializationRows.includes(node.row) &&
        !skillTreeIsOath(node),
    )
    .flatMap((node) => {
      const spec = nodes.find(
        (option) =>
          skillTreeIsSpecOption(option) &&
          skillTreeNodeShortName(option) === node.row,
      );
      return spec && skillTreeNodeHasAncestor(nodes, node, spec.id)
        ? []
        : [
            analysisFail(
              `${node.name}: does not descend from the ${node.row} spec.`,
            ),
          ];
    });
}

function specIssues(
  job: JobContent,
  nodes: SkillTreeNodeContent[],
): AnalysisIssue[] {
  const specOaths = nodes.filter(
    (node) =>
      skillTreeIsOath(node) &&
      nodes.some(
        (option) =>
          node.optionSkillTreeNodeIds.includes(option.id) &&
          skillTreeIsSpecOption(option),
      ),
  );
  if (specOaths.length !== 1) {
    return [analysisFail(`has ${specOaths.length} spec oaths, expected 1.`)];
  }

  const [oath] = specOaths;
  const options = nodes.filter((node) =>
    oath.optionSkillTreeNodeIds.includes(node.id),
  );
  const names = sortBy(options.map(skillTreeNodeShortName));
  const issues: AnalysisIssue[] = [];

  if (oath.level !== SKILL_TREE_SPEC_OATH_LEVEL) {
    issues.push(
      analysisFail(
        `${oath.name}: spec oath is not at level ${SKILL_TREE_SPEC_OATH_LEVEL}.`,
      ),
    );
  }
  if (names.join('|') !== sortBy(job.specializationRows).join('|')) {
    issues.push(
      analysisFail(
        `${oath.name}: options ${names.join(', ')} don't match specializationRows.`,
      ),
    );
  }
  if (options.some((option) => option.sprite === '')) {
    issues.push(
      analysisFail(`${oath.name}: every spec option needs a sprite.`),
    );
  }

  return issues;
}

function effectIssues(node: SkillTreeNodeContent): AnalysisIssue[] {
  return node.effects.flatMap((effect) => {
    if (
      effect.kind === 'GrantSkill' &&
      getEntry<EquipmentSkillContent>(effect.skillId)?.__type !== 'skill'
    ) {
      return [
        analysisFail(`${node.name}: grants unknown skill "${effect.skillId}".`),
      ];
    }

    if (
      effect.kind === 'JobAbility' &&
      getEntry<JobAbilityContent>(effect.jobAbilityId)?.__type !== 'jobability'
    ) {
      return [
        analysisFail(
          `${node.name}: grants unknown ability "${effect.jobAbilityId}".`,
        ),
      ];
    }

    return [];
  });
}

function defaultIssues(
  job: JobContent,
  nodes: SkillTreeNodeContent[],
): AnalysisIssue[] {
  const defaults = nodes.filter((node) => node.default);
  const issues: AnalysisIssue[] = defaults
    .filter(
      (node) =>
        node.requiredSkillTreeNodeIds.length > 0 ||
        node.level !== 1 ||
        !!skillTreeOptionOath(nodes, node.id),
    )
    .map((node) =>
      analysisFail(
        `${node.name}: a default node must be a free-standing Lv 1 node.`,
      ),
    );

  if (defaults.length !== SKILL_TREE_STARTING_SP) {
    issues.push(
      analysisFail(
        `has ${defaults.length} default nodes, expected ${SKILL_TREE_STARTING_SP}.`,
      ),
    );
  }

  const defaultFamilies = skillTreeGrantedSkills(defaults).map(
    (skill) => skill.family,
  );
  job.defaultCombatOrders.forEach(({ action }) => {
    if ('family' in action && !defaultFamilies.includes(action.family)) {
      issues.push(
        analysisFail(
          `default combat order uses ${action.family}, which no default node grants.`,
        ),
      );
    }
  });

  return issues;
}

function columnCountIssues(job: JobContent): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  if (
    job.treeRows.length === 0 ||
    job.treeRows.length > SKILL_TREE_MAX_BASE_COLUMNS
  ) {
    issues.push(
      analysisFail(
        `has ${job.treeRows.length} treeRows, expected 1 to ${SKILL_TREE_MAX_BASE_COLUMNS}.`,
      ),
    );
  }
  if (job.specializationRows.length !== SKILL_TREE_SPEC_COLUMNS) {
    issues.push(
      analysisFail(
        `has ${job.specializationRows.length} specializationRows, expected ${SKILL_TREE_SPEC_COLUMNS}.`,
      ),
    );
  }
  return issues;
}

function jobTreeIssues(job: JobContent): AnalysisIssue[] {
  const nodes = skillTreeJobNodes(job.id);
  const placed = placedNodes(nodes);

  return [
    ...columnCountIssues(job),
    ...placed.flatMap((node) => placementIssues(job, node)),
    ...slotIssues(placed),
    ...placed.flatMap((node) => requirementIssues(nodes, node)),
    ...nodes.filter(skillTreeIsOath).flatMap((oath) => oathIssues(nodes, oath)),
    ...sharedOptionIssues(nodes),
    ...specIssues(job, nodes),
    ...specLineageIssues(job, nodes),
    ...nodes.flatMap(effectIssues),
    ...defaultIssues(job, nodes),
    ...skillTreeRankIssues(nodes),
    ...skillTreeModifierIssues(nodes),
  ];
}

function orphanNodeIssues(jobs: JobContent[]): AnalysisIssue[] {
  const jobIds = jobs.map((job) => job.id);
  return getEntriesByType<SkillTreeNodeContent>('skilltreenode')
    .filter((node) => !jobIds.includes(node.jobId))
    .map((node) =>
      analysisFail(`${node.name}: jobId "${node.jobId}" is not a job.`),
    );
}

export function runSkillTreesAnalysis(): AnalysisRunResult {
  const jobs = getEntriesByType<JobContent>('job');

  const checks: AnalysisCheck[] = [
    ...jobs.flatMap((job) =>
      analysisIssueChecks(
        `skilltrees:job:${job.id}`,
        job.name,
        jobTreeIssues(job),
        `${job.name}: ${skillTreeJobNodes(job.id).length} nodes, all valid.`,
      ),
    ),
    ...analysisIssueChecks(
      'skilltrees:orphans',
      'Orphan nodes',
      orphanNodeIssues(jobs),
      'Every node belongs to a job.',
    ),
  ];

  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every skill tree (${jobs.length} jobs) is valid.`
        : `${failures} skill tree problem(s) found.`,
  };
}
