import { getEntry } from '@helpers/content/content';
import { defaultHeroRunStats } from '@helpers/defaults';
import {
  skillTreeIsSpecOption,
  skillTreeNodeShortName,
} from '@helpers/hero/skill-tree-content';
import type {
  Character,
  HeroRunStats,
  JobId,
  RunRecordArt,
  RunRecordHero,
  RunRecordHeroSnapshot,
  SkillTreeNodeContent,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

function legacyHeroSpecialization(hero: Character): RunRecordArt | undefined {
  const spec = (hero.skillTreeNodes[hero.jobId] ?? [])
    .map((id) => getEntry<SkillTreeNodeContent>(id))
    .find((node) => !!node && skillTreeIsSpecOption(node));

  return spec
    ? { name: skillTreeNodeShortName(spec), sprite: spec.sprite }
    : undefined;
}

export function legacyHeroSnapshot(hero: Character): RunRecordHeroSnapshot {
  return {
    specialization: legacyHeroSpecialization(hero),
    jobsUsed: uniq([hero.jobId, ...(Object.keys(hero.jobProgress) as JobId[])]),
  };
}

export function legacyRunHero(
  hero: Character,
  stats: HeroRunStats | undefined,
): RunRecordHero {
  return {
    name: hero.name,
    jobId: hero.jobId,
    level: hero.level,
    stats: stats ?? defaultHeroRunStats(),
    snapshot: legacyHeroSnapshot(hero),
  };
}
