import {
  SKILL_TREE_COLUMN_INTERVAL,
  SKILL_TREE_MAX_COLUMN_LEVEL,
} from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import type { JobId, SkillTreeNodeContent, SkillTreeNodeId } from '@interfaces';

export function skillTreeJobNodes(jobId: JobId): SkillTreeNodeContent[] {
  return getEntriesByType<SkillTreeNodeContent>('skilltreenode').filter(
    (node) => node.jobId === jobId,
  );
}

export function skillTreeIsOath(node: SkillTreeNodeContent): boolean {
  return node.optionSkillTreeNodeIds.length > 0;
}

export function skillTreeIsSpecOption(node: SkillTreeNodeContent): boolean {
  return node.specIcon !== '';
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
