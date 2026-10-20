import {
  SKILL_TREE_COLUMN_INTERVAL,
  SKILL_TREE_MAX_COLUMN_LEVEL,
} from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { sortBy } from 'es-toolkit/compat';
import type {
  Character,
  JobContent,
  JobId,
  SkillTreeNodeContent,
  SkillTreeNodeEffect,
  SkillTreeNodeId,
  SkillTreeSkillGrant,
} from '@interfaces';

export function skillTreeJobNodes(jobId: JobId): SkillTreeNodeContent[] {
  return getEntriesByType<SkillTreeNodeContent>('skilltreenode').filter(
    (node) => node.jobId === jobId,
  );
}

export function skillTreeIsOath(node: SkillTreeNodeContent): boolean {
  return node.optionSkillTreeNodeIds.length > 0;
}

// An oath option named after one of its job's specialization columns.
export function skillTreeIsSpecOption(node: SkillTreeNodeContent): boolean {
  const specRows: string[] =
    getEntry<JobContent>(node.jobId)?.specializationRows ?? [];
  return node.row === '' && specRows.includes(skillTreeNodeShortName(node));
}

export function skillTreeOptionOath(
  nodes: SkillTreeNodeContent[],
  optionId: SkillTreeNodeId,
): SkillTreeNodeContent | undefined {
  return nodes.find((node) => node.optionSkillTreeNodeIds.includes(optionId));
}

// Oath options carry no level of their own; they sit in their oath's column.
export function skillTreeNodeLevel(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
): number {
  return skillTreeOptionOath(nodes, node.id)?.level ?? node.level;
}

export function skillTreeIsLevelColumn(level: number): boolean {
  return (
    level === 1 ||
    (level > 0 &&
      level <= SKILL_TREE_MAX_COLUMN_LEVEL &&
      level % SKILL_TREE_COLUMN_INTERVAL === 0)
  );
}

// The display name without the '<Job>: ' uniqueness prefix.
export function skillTreeNodeShortName(node: SkillTreeNodeContent): string {
  return node.name.slice(node.name.indexOf(':') + 1).trim();
}

export function skillTreeDefaultNodeIds(jobId: JobId): SkillTreeNodeId[] {
  return skillTreeJobNodes(jobId)
    .filter((node) => node.default)
    .map((node) => node.id);
}

// Skill modifiers carry their node's name, so a skill's description can say where each came from.
export function skillTreeNodeEffects(
  nodeIds: SkillTreeNodeId[],
): SkillTreeNodeEffect[] {
  return nodeIds.flatMap((nodeId) => {
    const node = getEntry<SkillTreeNodeContent>(nodeId);
    if (!node) return [];

    return node.effects.map((effect) =>
      effect.kind === 'SkillModifier'
        ? { ...effect, source: skillTreeNodeShortName(node) }
        : effect,
    );
  });
}

// Built against an older treeVersion than the job has now.
export function characterSkillTreeStale(
  character: Pick<Character, 'skillTreeVersions'>,
  jobId: JobId,
): boolean {
  const version = getEntry<JobContent>(jobId)?.treeVersion ?? 0;
  return (character.skillTreeVersions?.[jobId] ?? 0) < version;
}

// A job never held, or built against an older treeVersion, starts over at its defaults.
export function characterSkillTreeSeeded(
  character: Pick<Character, 'skillTreeNodes' | 'skillTreeVersions'>,
  jobId: JobId,
): Pick<Character, 'skillTreeNodes' | 'skillTreeVersions'> {
  const version = getEntry<JobContent>(jobId)?.treeVersion ?? 0;
  const nodeIds = character.skillTreeNodes?.[jobId];
  const stale = characterSkillTreeStale(character, jobId);

  return {
    skillTreeNodes: {
      ...character.skillTreeNodes,
      [jobId]: !nodeIds || stale ? skillTreeDefaultNodeIds(jobId) : nodeIds,
    },
    skillTreeVersions: { ...character.skillTreeVersions, [jobId]: version },
  };
}

export function skillTreeJobSkillGrants(jobId: JobId): SkillTreeSkillGrant[] {
  const nodes = skillTreeJobNodes(jobId);
  const grants = nodes.flatMap((node) =>
    node.effects.flatMap((effect) =>
      effect.kind === 'GrantSkill'
        ? [
            {
              skillId: effect.skillId,
              level: skillTreeNodeLevel(nodes, node),
              isDefault: node.default,
            },
          ]
        : [],
    ),
  );

  return sortBy(grants, (grant) => grant.level);
}

export function skillTreeNodeHasAncestor(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
  ancestorId: SkillTreeNodeId,
  seen = new Set<SkillTreeNodeId>(),
): boolean {
  if (seen.has(node.id)) return false;
  seen.add(node.id);

  return node.requiredSkillTreeNodeIds.some((parentId) => {
    const parent = nodes.find((candidate) => candidate.id === parentId);
    return (
      parentId === ancestorId ||
      (!!parent && skillTreeNodeHasAncestor(nodes, parent, ancestorId, seen))
    );
  });
}
