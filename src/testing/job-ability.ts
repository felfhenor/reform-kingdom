import { VALID_JOB_ABILITY_TYPES } from '@helpers/content/ensure-helpers-constants';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureJobAbility } from '@helpers/content/ensure-jobability';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { defaultStats } from '@helpers/defaults';
import type {
  Character,
  IsContentItem,
  JobAbilityId,
  JobAbilityType,
  JobId,
  SkillTreeNodeId,
  StatBlock,
} from '@interfaces';
import { range } from 'es-toolkit/compat';
import { buildCharacter } from '@/testing/builders';

// One ability of `type`, named after it.
export function buildJobAbility(type: JobAbilityType) {
  return ensureJobAbility({
    id: `${type}-id` as JobAbilityId,
    name: type,
    type,
  });
}

function abilityNodeId(jobName: string, type: JobAbilityType, level: number) {
  return `${jobName}-${type}-${level}` as SkillTreeNodeId;
}

// One tree node per [type, level, value] rank; buildAbilityHero learns those at or below its level.
function buildAbilityNodes(
  jobName: string,
  ranks: [JobAbilityType, number, number][],
) {
  return ranks.map(([type, level, value]) =>
    ensureSkillTreeNode({
      id: abilityNodeId(jobName, type, level),
      name: `${jobName}: ${type} ${level}`,
      jobId: `${jobName}-id` as JobId,
      level,
      effects: [
        {
          kind: 'JobAbility',
          jobAbilityId: `${type}-id` as JobAbilityId,
          value,
        },
      ],
    }),
  );
}

// The job, its rank nodes and every ability it references, ready for seedContent.
export function abilityJobContent(
  name: string,
  ranks: [JobAbilityType, number, number][],
): IsContentItem[] {
  const types = [...new Set(ranks.map(([type]) => type))];
  return [
    ensureJob({ id: `${name}-id` as JobId, name }),
    ...buildAbilityNodes(name, ranks),
    ...types.map(buildJobAbility),
  ];
}

export function buildAbilityHero(
  jobName: string,
  level: number,
  stats: Partial<StatBlock> = {},
  overrides: Partial<Character> = {},
): Character {
  const jobId = `${jobName}-id` as JobId;
  // Every rank id this job could have at or below `level`, so it works before or after seedContent; ids with no node are ignored.
  const learned = VALID_JOB_ABILITY_TYPES.flatMap((type) =>
    range(1, level + 1).map((rankLevel) =>
      abilityNodeId(jobName, type, rankLevel),
    ),
  );

  return buildCharacter({
    name: `${jobName} ${level}`,
    jobId,
    level,
    skillTreeNodes: { [jobId]: learned },
    stats: { ...defaultStats(), Health: 100, Energy: 100, ...stats },
    ...overrides,
  });
}
