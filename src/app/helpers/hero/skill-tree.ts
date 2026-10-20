import {
  SKILL_TREE_MAX_COLUMN_LEVEL,
  SKILL_TREE_SP_LEVEL_INTERVAL,
  SKILL_TREE_STARTING_SP,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { characterJobLevel } from '@helpers/hero/job';
import {
  characterSkillTreeSeeded,
  characterSkillTreeStale,
  skillTreeIsOath,
  skillTreeIsSpecOption,
  skillTreeJobNodes,
  skillTreeNodeLevel,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import type {
  Character,
  JobContent,
  JobId,
  Regalia,
  SkillTreeNodeContent,
  SkillTreeNodeId,
} from '@interfaces';
import { clamp, sortBy, uniq } from 'es-toolkit/compat';

export function skillTreeEarnedSp(level: number): number {
  const counted = clamp(level, 1, SKILL_TREE_MAX_COLUMN_LEVEL);
  return (
    SKILL_TREE_STARTING_SP +
    Math.floor((counted - 1) / SKILL_TREE_SP_LEVEL_INTERVAL)
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

// Requiring an oath is satisfied by either of its options.
function skillTreeRequirementMet(
  nodes: SkillTreeNodeContent[],
  learned: Set<SkillTreeNodeId>,
  requiredId: SkillTreeNodeId,
): boolean {
  const required = nodes.find((node) => node.id === requiredId);
  return required && skillTreeIsOath(required)
    ? required.optionSkillTreeNodeIds.some((id) => learned.has(id))
    : learned.has(requiredId);
}

// Ignores SP; an oath option takes its oath's requirements and is locked out once its sibling is learned.
export function skillTreeNodeIsLearnable(
  nodes: SkillTreeNodeContent[],
  learned: Set<SkillTreeNodeId>,
  node: SkillTreeNodeContent,
  level: number,
): boolean {
  if (learned.has(node.id) || skillTreeIsOath(node)) return false;
  if (skillTreeNodeLevel(nodes, node) > level) return false;

  const oath = skillTreeOptionOath(nodes, node.id);
  if (oath?.optionSkillTreeNodeIds.some((id) => learned.has(id))) return false;

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
  const learned = new Set(
    characterSkillTreeNodeIds(character, character.jobId),
  );

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
  const learned = new Set(current);
  return added.every((node) => {
    const learnable = skillTreeNodeIsLearnable(nodes, learned, node, level);
    learned.add(node.id);
    return learnable;
  });
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
  const added = sortBy(
    nodes.filter(
      (node) => nodeIds.includes(node.id) && !current.includes(node.id),
    ),
    (node) => skillTreeNodeLevel(nodes, node),
  );

  const valid =
    current.every((id) => nodeIds.includes(id)) &&
    current.length + added.length === uniq(nodeIds).length &&
    added.length <= characterSkillTreeAvailableSp(character, character.jobId) &&
    skillTreeAdditionsLearnable(nodes, current, added, character.level);

  return valid ? [...current, ...added.map((node) => node.id)] : undefined;
}

// What a hands-off player would buy: lowest level first, an oath's first option, until SP runs out.
export function characterSkillTreeAutoPicks(
  character: Pick<
    Character,
    'jobId' | 'level' | 'jobProgress' | 'skillTreeNodes'
  >,
): SkillTreeNodeId[] {
  let sp = characterSkillTreeAvailableSp(character, character.jobId);
  if (sp <= 0) return [];

  const nodes = skillTreeJobNodes(character.jobId);
  const learned = new Set(
    characterSkillTreeNodeIds(character, character.jobId),
  );
  const picks: SkillTreeNodeId[] = [];

  sortBy(nodes, (node) => skillTreeNodeLevel(nodes, node)).forEach((node) => {
    if (sp <= 0) return;
    if (!skillTreeNodeIsLearnable(nodes, learned, node, character.level))
      return;

    learned.add(node.id);
    picks.push(node.id);
    sp -= 1;
  });

  return picks;
}

// Parents always sit at a lower level, so rebuilding in level order drops unknown, too-high, orphaned and duplicate oath picks in one pass.
export function skillTreePrune(
  jobId: JobId,
  nodeIds: SkillTreeNodeId[],
  level: number,
): SkillTreeNodeId[] {
  const nodes = skillTreeJobNodes(jobId);
  const known = nodes.filter((node) => nodeIds.includes(node.id));
  const kept = new Set<SkillTreeNodeId>();

  sortBy(known, (node) => skillTreeNodeLevel(nodes, node)).forEach((node) => {
    if (skillTreeNodeIsLearnable(nodes, kept, node, level)) kept.add(node.id);
  });

  // Over budget (e.g. the SP rate changed): refund from the top, which never orphans a kept node.
  return [...kept].slice(0, skillTreeEarnedSp(level));
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
