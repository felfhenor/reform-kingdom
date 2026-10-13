import { ensureJob } from '@helpers/content/ensure-job';
import { ensureJobAbility } from '@helpers/content/ensure-jobability';
import { defaultStats } from '@helpers/defaults';
import type {
  Character,
  IsContentItem,
  JobAbilityId,
  JobAbilityType,
  JobId,
  StatBlock,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';

// One ability of `type`, named after it.
export function buildJobAbility(type: JobAbilityType) {
  return ensureJobAbility({
    id: `${type}-id` as JobAbilityId,
    name: type,
    type,
  });
}

// A job whose abilities are given as [type, level, value] ranks.
export function buildAbilityJob(
  name: string,
  ranks: [JobAbilityType, number, number][],
) {
  return ensureJob({
    id: `${name}-id` as JobId,
    name,
    abilities: ranks.map(([type, level, value]) => ({
      jobAbilityId: `${type}-id` as JobAbilityId,
      level,
      value,
    })),
  });
}

// The job plus every ability it references, ready for seedContent.
export function abilityJobContent(
  name: string,
  ranks: [JobAbilityType, number, number][],
): IsContentItem[] {
  const types = [...new Set(ranks.map(([type]) => type))];
  return [buildAbilityJob(name, ranks), ...types.map(buildJobAbility)];
}

export function buildAbilityHero(
  jobName: string,
  level: number,
  stats: Partial<StatBlock> = {},
  overrides: Partial<Character> = {},
): Character {
  return buildCharacter({
    name: `${jobName} ${level}`,
    jobId: `${jobName}-id` as JobId,
    level,
    stats: { ...defaultStats(), Health: 100, Energy: 100, ...stats },
    ...overrides,
  });
}
