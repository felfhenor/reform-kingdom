// SP each job's tree costs to fill per spec build, split by node kind, against the SP earned by the level cap.

import { SKILL_TREE_MAX_COLUMN_LEVEL } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { skillTreeEarnedSp } from '@helpers/hero/skill-tree';
import {
  skillTreeIsOath,
  skillTreeIsSpecOption,
  skillTreeJobNodes,
  skillTreeNodeHasAncestor,
  skillTreeNodeLevel,
  skillTreeNodeShortName,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import { skillTreeNodeKind } from '@helpers/hero/skill-tree-node';
import type {
  AnalysisRunResult,
  AnalysisTable,
  JobContent,
  SkillTreeNodeContent,
  SkillTreeNodeEffect,
  SkillTreeNodeKind,
} from '@interfaces';
import { countBy, sortBy } from 'es-toolkit/compat';

const NODE_KINDS: SkillTreeNodeKind[] = [
  'Skill',
  'Burst Skill',
  'Job Ability',
  'Perk',
  'Skill Modifier',
  'Specialization',
];

// Oaths only hold their options, so they cost no SP.
function nodeType(node: SkillTreeNodeContent): string {
  return skillTreeIsOath(node) ? 'Oath' : skillTreeNodeKind(node);
}

// Oath options have no requirements of their own, so they follow their oath's lineage.
function skillTreeNodeSpec(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
): SkillTreeNodeContent | undefined {
  const placed = skillTreeOptionOath(nodes, node.id) ?? node;
  return nodes
    .filter(skillTreeIsSpecOption)
    .find(
      (spec) =>
        spec.id === node.id || skillTreeNodeHasAncestor(nodes, placed, spec.id),
    );
}

// Everything one spec can learn, taking a single option from each oath.
function skillTreeBuildNodes(
  nodes: SkillTreeNodeContent[],
  spec: SkillTreeNodeContent,
): SkillTreeNodeContent[] {
  const inBuild = nodes.filter((node) => {
    const owner = skillTreeNodeSpec(nodes, node);
    return !owner || owner.id === spec.id;
  });
  const inBuildIds = new Set(inBuild.map((node) => node.id));
  const skipped = new Set(
    inBuild
      .filter(skillTreeIsOath)
      .flatMap((oath) =>
        oath.optionSkillTreeNodeIds.filter((id) => inBuildIds.has(id)).slice(1),
      ),
  );

  return inBuild.filter(
    (node) => !skillTreeIsOath(node) && !skipped.has(node.id),
  );
}

function kindCounts(
  nodes: SkillTreeNodeContent[],
  kinds: string[],
): Record<string, number> {
  const counts = countBy(nodes, nodeType);
  return Object.fromEntries(kinds.map((kind) => [kind, counts[kind] ?? 0]));
}

function nodeCountTable(jobs: JobContent[]): AnalysisTable {
  return {
    title: 'Nodes by type',
    columns: ['Job', ...NODE_KINDS, 'Oath', 'Total'],
    rows: jobs.map((job) => {
      const nodes = skillTreeJobNodes(job.id);
      return {
        Job: job.name,
        ...kindCounts(nodes, [...NODE_KINDS, 'Oath']),
        Total: nodes.length,
      };
    }),
  };
}

function buildSpTable(jobs: JobContent[], earnedSp: number): AnalysisTable {
  return {
    title: `SP to fill each build (earned by Lv ${SKILL_TREE_MAX_COLUMN_LEVEL}: ${earnedSp})`,
    columns: ['Build', ...NODE_KINDS, 'Total SP', 'Slack'],
    rows: jobs.flatMap((job) => {
      const nodes = skillTreeJobNodes(job.id);
      return nodes.filter(skillTreeIsSpecOption).map((spec) => {
        const build = skillTreeBuildNodes(nodes, spec);
        return {
          Build: `${job.name} / ${skillTreeNodeShortName(spec)}`,
          ...kindCounts(build, NODE_KINDS),
          'Total SP': build.length,
          Slack: earnedSp - build.length,
        };
      });
    }),
  };
}

function effectLabel(effect: SkillTreeNodeEffect): string {
  const { kind, ...fields } = effect;
  const values = Object.values(fields).map(
    (value) => getEntry(String(value))?.name ?? value,
  );
  return `${kind} ${values.join(' ')}`;
}

function jobNodeTable(job: JobContent): AnalysisTable {
  const nodes = skillTreeJobNodes(job.id);
  const sorted = sortBy(nodes, [
    (node) => [...NODE_KINDS, 'Oath'].indexOf(nodeType(node)),
    (node) => skillTreeNodeLevel(nodes, node),
    (node) => node.name,
  ]);

  return {
    title: `${job.name} nodes`,
    columns: ['Node', 'Type', 'Spec', 'Level', 'Effects'],
    rows: sorted.map((node) => {
      const spec = skillTreeNodeSpec(nodes, node);
      return {
        Node: skillTreeNodeShortName(node),
        Type: nodeType(node),
        Spec: spec ? skillTreeNodeShortName(spec) : '',
        Level: skillTreeNodeLevel(nodes, node),
        Effects: node.effects.map(effectLabel).join('; '),
      };
    }),
  };
}

export function runSkillTreeSpAnalysis(): AnalysisRunResult {
  const jobs = sortBy(getEntriesByType<JobContent>('job'), 'name');
  const earnedSp = skillTreeEarnedSp(SKILL_TREE_MAX_COLUMN_LEVEL);
  const builds = buildSpTable(jobs, earnedSp);

  return {
    checks: [],
    tables: [nodeCountTable(jobs), builds, ...jobs.map(jobNodeTable)],
    summary: builds.rows
      .map((row) => `${row['Build']}: ${row['Total SP']}/${earnedSp} SP`)
      .join('\n'),
  };
}
