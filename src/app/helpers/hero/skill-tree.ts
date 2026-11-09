import { SKILL_TREE_MAX_COLUMN_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { characterJobLevel } from '@helpers/hero/job';
import {
  characterSkillTreeSeeded,
  characterSkillTreeStale,
  skillTreeBaseSp,
  skillTreeIsOath,
  skillTreeIsSpecOption,
  skillTreeJobNodes,
  skillTreeLevelsGained,
  skillTreeNodeLevel,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import { skillTreeNodeKind } from '@helpers/hero/skill-tree-node';
import { globalEffectSumsState } from '@helpers/state-game';
import type {
  Character,
  JobContent,
  JobId,
  Regalia,
  SkillTreeNodeContent,
  SkillTreeNodeId,
} from '@interfaces';
import { partition, sortBy, takeWhile } from 'es-toolkit/compat';

// Migration reads the save's own sums here, where a pre-bonus save has no key.
export function skillTreeEarnedSp(level: number): number {
  const bonus = globalEffectSumsState().skillPointsPerLevel ?? 0;
  return (
    skillTreeBaseSp(level) + Math.floor(skillTreeLevelsGained(level) * bonus)
  );
}

export function characterSkillTreeNodeIds(
  character: Pick<Character, 'skillTreeNodes'>,
  jobId: JobId,
): SkillTreeNodeId[] {
  return character.skillTreeNodes?.[jobId] ?? [];
}

// A stale tree is about to reset to its defaults, so its spec no longer counts.
export function characterSpecNode(
  character: Pick<Character, 'jobId' | 'skillTreeNodes' | 'skillTreeVersions'>,
  jobId: JobId = character.jobId,
): SkillTreeNodeContent | undefined {
  if (characterSkillTreeStale(character, jobId)) return undefined;

  return characterSkillTreeNodeIds(character, jobId)
    .map((id) => getEntry<SkillTreeNodeContent>(id))
    .find((node) => !!node && skillTreeIsSpecOption(node));
}

export function characterSkillTreeAvailableSp(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
  jobId: JobId,
): number {
  return (
    skillTreeEarnedSp(characterJobLevel(character, jobId)) -
    characterSkillTreeNodeIds(character, jobId).length
  );
}

// A tree holds one copy of a node's id per rank learned, so its length is always the SP it cost.
export function skillTreeNodeRank(
  nodeIds: SkillTreeNodeId[],
  nodeId: SkillTreeNodeId,
): number {
  return nodeIds.filter((id) => id === nodeId).length;
}

// Takes out one copy per entry of `removed`; undefined if `nodeIds` doesn't hold them all.
export function skillTreeIdsWithout(
  nodeIds: SkillTreeNodeId[],
  removed: SkillTreeNodeId[],
): SkillTreeNodeId[] | undefined {
  const remaining = [...nodeIds];
  const allFound = removed.every((id) => {
    const index = remaining.indexOf(id);
    if (index >= 0) remaining.splice(index, 1);
    return index >= 0;
  });
  return allFound ? remaining : undefined;
}

// Takes out one copy per entry of `removed`, skipping any that aren't there.
export function skillTreeIdsWithoutPresent(
  nodeIds: SkillTreeNodeId[],
  removed: SkillTreeNodeId[],
): SkillTreeNodeId[] {
  return removed.reduce(
    (remaining, id) => skillTreeIdsWithout(remaining, [id]) ?? remaining,
    nodeIds,
  );
}

// Requiring an oath is satisfied by either of its options; any rank of a node satisfies it.
function skillTreeRequirementMet(
  nodes: SkillTreeNodeContent[],
  learned: SkillTreeNodeId[],
  requiredId: SkillTreeNodeId,
): boolean {
  const required = nodes.find((node) => node.id === requiredId);
  return required && skillTreeIsOath(required)
    ? required.optionSkillTreeNodeIds.some((id) => learned.includes(id))
    : learned.includes(requiredId);
}

// Whether one more rank can be learned, ignoring SP; an oath option takes its oath's requirements and is locked out once its sibling is learned.
export function skillTreeNodeIsLearnable(
  nodes: SkillTreeNodeContent[],
  learned: SkillTreeNodeId[],
  node: SkillTreeNodeContent,
  level: number,
): boolean {
  if (skillTreeIsOath(node)) return false;
  if (skillTreeNodeRank(learned, node.id) >= node.maxRank) return false;
  if (skillTreeNodeLevel(nodes, node) > level) return false;

  const oath = skillTreeOptionOath(nodes, node.id);
  const siblingLearned = oath?.optionSkillTreeNodeIds.some(
    (id) => id !== node.id && learned.includes(id),
  );
  if (siblingLearned) return false;

  return (oath ?? node).requiredSkillTreeNodeIds.every((requiredId) =>
    skillTreeRequirementMet(nodes, learned, requiredId),
  );
}

// For the hero's current job: the node must be learnable now and an SP must be free.
export function characterSkillTreeCanLearn(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
  nodeId: SkillTreeNodeId,
): boolean {
  const nodes = skillTreeJobNodes(character.jobId);
  const node = nodes.find((candidate) => candidate.id === nodeId);
  const learned = characterSkillTreeNodeIds(character, character.jobId);

  return (
    !!node &&
    characterSkillTreeAvailableSp(character, character.jobId) > 0 &&
    skillTreeNodeIsLearnable(nodes, learned, node, character.level)
  );
}

// Learning the additions in level order, each must be learnable given everything before it.
function skillTreeAdditionsLearnable(
  nodes: SkillTreeNodeContent[],
  current: SkillTreeNodeId[],
  added: SkillTreeNodeContent[],
  level: number,
): boolean {
  const learned = [...current];
  return added.every((node) => {
    const learnable = skillTreeNodeIsLearnable(nodes, learned, node, level);
    learned.push(node.id);
    return learnable;
  });
}

// Each id as its node (repeats kept), in level order; undefined if any id is unknown.
function skillTreeNodesInLevelOrder(
  nodes: SkillTreeNodeContent[],
  nodeIds: SkillTreeNodeId[],
): SkillTreeNodeContent[] | undefined {
  const found = nodeIds.map((id) => nodes.find((node) => node.id === id));
  if (found.some((node) => !node)) return undefined;

  return sortBy(found as SkillTreeNodeContent[], (node) =>
    skillTreeNodeLevel(nodes, node),
  );
}

// Confirm only ever adds: undefined if anything learned would be dropped, an id is unknown, or the additions aren't learnable within the free SP.
export function characterSkillTreeWithAdditions(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
  nodeIds: SkillTreeNodeId[],
): SkillTreeNodeId[] | undefined {
  const current = characterSkillTreeNodeIds(character, character.jobId);
  const nodes = skillTreeJobNodes(character.jobId);
  const addedIds = skillTreeIdsWithout(nodeIds, current);
  const added = addedIds
    ? skillTreeNodesInLevelOrder(nodes, addedIds)
    : undefined;

  const valid =
    !!added &&
    added.length <= characterSkillTreeAvailableSp(character, character.jobId) &&
    skillTreeAdditionsLearnable(nodes, current, added, character.level);

  return valid ? [...current, ...added.map((node) => node.id)] : undefined;
}

// Everything a hands-off player will eventually buy, in order: lowest level first, an oath's first option, perks (every rank) only after all else.
function skillTreeAutoPickPlan(
  nodes: SkillTreeNodeContent[],
  learned: SkillTreeNodeId[],
): SkillTreeNodeContent[] {
  const planned = [...learned];
  const [perks, others] = partition(
    sortBy(nodes, (node) => skillTreeNodeLevel(nodes, node)),
    (node) => skillTreeNodeKind(node) === 'Perk',
  );
  const ranks = [...others, ...perks].flatMap((node) =>
    Array<SkillTreeNodeContent>(node.maxRank).fill(node),
  );

  return ranks.filter((node) => {
    if (
      !skillTreeNodeIsLearnable(
        nodes,
        planned,
        node,
        SKILL_TREE_MAX_COLUMN_LEVEL,
      )
    )
      return false;

    planned.push(node.id);
    return true;
  });
}

// Follows the plan until it reaches a node above the hero's level, banking SP rather than buying perks early.
export function characterSkillTreeAutoPicks(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
): SkillTreeNodeId[] {
  const sp = characterSkillTreeAvailableSp(character, character.jobId);
  if (sp <= 0) return [];

  const nodes = skillTreeJobNodes(character.jobId);
  const plan = skillTreeAutoPickPlan(
    nodes,
    characterSkillTreeNodeIds(character, character.jobId),
  );

  return takeWhile(
    plan,
    (node) => skillTreeNodeLevel(nodes, node) <= character.level,
  )
    .slice(0, sp)
    .map((node) => node.id);
}

// Parents always sit at a lower level, so rebuilding in level order drops unknown, too-high, orphaned, over-ranked and duplicate oath picks in one pass.
export function skillTreePrune(
  jobId: JobId,
  nodeIds: SkillTreeNodeId[],
  level: number,
): SkillTreeNodeId[] {
  const nodes = skillTreeJobNodes(jobId);
  const known = nodeIds.filter((id) => nodes.some((node) => node.id === id));
  const kept: SkillTreeNodeId[] = [];

  skillTreeNodesInLevelOrder(nodes, known)?.forEach((node) => {
    if (skillTreeNodeIsLearnable(nodes, kept, node, level)) kept.push(node.id);
  });

  // Over budget (e.g. the SP rate changed): refund from the top, which never orphans a kept node.
  return kept.slice(0, skillTreeEarnedSp(level));
}

// Seeds unseen or stale trees, then prunes each held job's tree against its own level; trees of removed jobs are dropped.
export function characterSkillTreesMigrate(
  character: Character,
): Pick<Character, 'skillTreeNodes' | 'skillTreeVersions'> {
  const migrated: Pick<Character, 'skillTreeNodes' | 'skillTreeVersions'> = {
    skillTreeNodes: {},
    skillTreeVersions: {},
  };

  characterHeldJobIds(character).forEach((jobId) => {
    const seeded = characterSkillTreeSeeded(character, jobId);
    migrated.skillTreeNodes[jobId] = skillTreePrune(
      jobId,
      seeded.skillTreeNodes[jobId] ?? [],
      characterJobLevel(character, jobId),
    );
    migrated.skillTreeVersions[jobId] = seeded.skillTreeVersions[jobId];
  });

  return migrated;
}

function characterHeldJobIds(character: Character): JobId[] {
  return [
    character.jobId,
    ...(Object.keys(character.jobProgress ?? {}) as JobId[]),
  ].filter((jobId) => !!getEntry<JobContent>(jobId));
}

// A regalia's build gets the same seeding and pruning as its hero's tree for that job.
export function regaliaSkillTreeMigrate(
  regalia: Regalia,
  character: Character,
): Pick<Regalia, 'skillTreeNodeIds' | 'skillTreeVersion'> {
  const { jobId } = regalia;
  const seeded = characterSkillTreeSeeded(
    {
      skillTreeNodes: { [jobId]: regalia.skillTreeNodeIds },
      skillTreeVersions: { [jobId]: regalia.skillTreeVersion },
    },
    jobId,
  );

  return {
    skillTreeNodeIds: skillTreePrune(
      jobId,
      seeded.skillTreeNodes[jobId] ?? [],
      characterJobLevel(character, jobId),
    ),
    skillTreeVersion: seeded.skillTreeVersions[jobId] ?? 0,
  };
}

export function partyFirstHeroWithFreeSp<
  T extends Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
>(party: T[]): T | undefined {
  return party.find(
    (character) =>
      characterSkillTreeAvailableSp(character, character.jobId) > 0,
  );
}
