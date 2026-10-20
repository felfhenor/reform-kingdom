import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import type {
  Character,
  JobId,
  SkillTreeNodeContent,
  SkillTreeNodeEffect,
  SkillTreeNodeId,
} from '@interfaces';

// A tree node carrying only `effects`: seed it, then learn it with heroLearning to grant them.
export function buildEffectNode(
  id: string,
  effects: SkillTreeNodeEffect[],
): SkillTreeNodeContent {
  return ensureSkillTreeNode({
    id: id as SkillTreeNodeId,
    name: `Test: ${id}`,
    jobId: 'test-job' as JobId,
    level: 1,
    effects,
  });
}

// Learns the nodes under the hero's current job, on top of what it already knows.
export function heroLearning<
  T extends Pick<Character, 'jobId' | 'skillTreeNodes'>,
>(hero: T, ...nodes: SkillTreeNodeContent[]): T {
  const learned = hero.skillTreeNodes[hero.jobId] ?? [];
  return {
    ...hero,
    skillTreeNodes: {
      ...hero.skillTreeNodes,
      [hero.jobId]: [...learned, ...nodes.map((node) => node.id)],
    },
  };
}
