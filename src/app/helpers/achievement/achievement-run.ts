import {
  ACHIEVEMENT_ONE_TRICK_MIN_USES,
  ACHIEVEMENT_ONE_TRICK_PERCENT,
  ACHIEVEMENT_PACIFIST_HEALER_MIN_KILLS,
} from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { legacyRunsClearedEdictIds } from '@helpers/legacy/legacy';
import type {
  AchievementConditionClearEdicts,
  AchievementConditionCompleteRun,
  AchievementHeroFeat,
  AchievementProgress,
  AchievementRunFilter,
  EdictContent,
  HeroRunStats,
  JobId,
  RunRecord,
  RunRecordHero,
} from '@interfaces';
import { omit, uniq } from 'es-toolkit';
import { sortBy, sum } from 'es-toolkit/compat';

const ACHIEVEMENT_BASIC_ATTACK_FAMILY = 'Attack';

function heroIsOneTrick(stats: HeroRunStats): boolean {
  const uses = Object.values(
    omit(stats.skillUses, [ACHIEVEMENT_BASIC_ATTACK_FAMILY]),
  );
  const total = sum(uses);
  return (
    total >= ACHIEVEMENT_ONE_TRICK_MIN_USES &&
    (Math.max(...uses) / total) * 100 >= ACHIEVEMENT_ONE_TRICK_PERCENT
  );
}

function heroIsPacifistHealer(stats: HeroRunStats): boolean {
  return (
    stats.healing > stats.damageDealt &&
    stats.kills >= ACHIEVEMENT_PACIFIST_HEALER_MIN_KILLS
  );
}

// Runs that began before stats were tracked have partial counts, so they can't earn a stat-based achievement.
function runStatsTracked(run: RunRecord): boolean {
  return run.stats.run?.trackedFromTick === 0;
}

// Older runs have no party from Fel's fall, so they're judged on the party they ended with.
function runParty(run: RunRecord): RunRecordHero[] {
  return run.stats.run?.felParty ?? run.party;
}

// Missing on runs recorded before snapshots, so those can't prove a hero's job history.
function heroJobsUsed(hero: RunRecordHero): JobId[] | undefined {
  return hero.snapshot?.jobsUsed;
}

const HERO_FEATS: Record<
  AchievementHeroFeat,
  (hero: RunRecordHero, run: RunRecord) => boolean
> = {
  OneTrick: (hero, run) =>
    runStatsTracked(run) && !!hero.stats && heroIsOneTrick(hero.stats),
  PacifistHealer: (hero, run) =>
    runStatsTracked(run) && !!hero.stats && heroIsPacifistHealer(hero.stats),
};

function runBoons(run: RunRecord): number {
  return run.edicts.filter((id) => getEntry<EdictContent>(id)?.kind === 'Boon')
    .length;
}

function runHasNoDeaths(run: RunRecord): boolean {
  return (
    runStatsTracked(run) &&
    runParty(run).every((hero) => !!hero.stats && hero.stats.deaths === 0)
  );
}

function runHasNoReclass(run: RunRecord): boolean {
  return runParty(run).every((hero) => heroJobsUsed(hero)?.length === 1);
}

function runAvoidedJobs(run: RunRecord, jobIds: JobId[]): boolean {
  return runParty(run).every((hero) => {
    const used = heroJobsUsed(hero);
    return !!used && !used.some((id) => jobIds.includes(id));
  });
}

const RUN_CHECKS: ((
  run: RunRecord,
  filter: AchievementRunFilter,
) => boolean)[] = [
  (run, filter) => run.edicts.length >= (filter.minEdicts ?? 0),
  (run, filter) =>
    run.edicts.length - runBoons(run) >= (filter.minNonBoonEdicts ?? 0),
  (run, filter) =>
    filter.minFragments === undefined || run.fragments >= filter.minFragments,
  (run, filter) =>
    (filter.edictIds ?? []).every((id) => run.edicts.includes(id)),
  (run, filter) =>
    !(filter.excludedEdictIds ?? []).some((id) => run.edicts.includes(id)),
  (run, filter) => runParty(run).length >= (filter.minPartySize ?? 0),
  (run, filter) =>
    !filter.sameJob ||
    uniq(runParty(run).map((hero) => hero.jobId)).length === 1,
  (run, filter) => {
    const feat = filter.heroFeat;
    return !feat || runParty(run).some((hero) => HERO_FEATS[feat](hero, run));
  },
  (run, filter) => !filter.noBoons || runBoons(run) === 0,
  (run, filter) => !filter.noDeaths || runHasNoDeaths(run),
  (run, filter) => !filter.noReclass || runHasNoReclass(run),
  (run, filter) =>
    !filter.excludedJobIds || runAvoidedJobs(run, filter.excludedJobIds),
  (run, filter) =>
    filter.maxFelTick === undefined ||
    (run.stats.run?.felDefeatedTick ?? Infinity) <= filter.maxFelTick,
];

export function achievementRunMatches(
  run: RunRecord,
  filter: AchievementRunFilter,
): boolean {
  return (
    run.outcome === 'Completed' &&
    RUN_CHECKS.every((check) => check(run, filter))
  );
}

export function achievementRunMatchCount(
  condition: AchievementConditionCompleteRun,
  runs: RunRecord[],
): number {
  return runs.filter((run) => achievementRunMatches(run, condition)).length;
}

// The run that brought the count up to the target, so the unlock dates from when it was really earned.
export function achievementRunEarner(
  condition: AchievementConditionCompleteRun,
  runs: RunRecord[],
): RunRecord | undefined {
  const matches = sortBy(
    runs.filter((run) => achievementRunMatches(run, condition)),
    (run) => run.endedAt,
  );
  return matches[(condition.count ?? 1) - 1];
}

export function achievementEdictsCleared(
  condition: AchievementConditionClearEdicts,
  runs: RunRecord[],
): AchievementProgress {
  const cleared = legacyRunsClearedEdictIds(runs);
  const edicts = getEntriesByType<EdictContent>('edict').filter(
    (edict) => edict.kind === condition.kind,
  );
  return {
    current: edicts.filter((edict) => cleared.includes(edict.id)).length,
    max: edicts.length,
  };
}
