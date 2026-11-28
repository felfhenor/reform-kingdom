import { t } from '@helpers/i18n/i18n';
import { achievementsCheckRun } from '@helpers/achievement/achievement-check';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { error } from '@helpers/engine/logging';
import { notifyError } from '@helpers/engine/notify';
import {
  legacy,
  legacyRecordRun,
  legacyRunById,
  legacyRunFromGame,
  legacyRunsClearedEdictIds,
} from '@helpers/legacy/legacy';
import { isFelDefeated, isRunLost } from '@helpers/lore/outro';
import { waitForGameloopIdle } from '@helpers/savefile/savefile-load';
import { updateGamestate } from '@helpers/state-game';
import type {
  EdictId,
  GameId,
  HeroRunStats,
  RunMostUsedSkill,
  RunAward,
  RunAwardDefinition,
  RunOutcome,
  RunRecord,
  RunStatRow,
  SavefileBackup,
} from '@interfaces';
import { maxBy, minBy } from 'es-toolkit/compat';

// Beating Fel counts even if a later wipe ended the run.
export function legacyRunOutcome(): RunOutcome {
  if (isFelDefeated()) return 'Completed';
  return isRunLost() ? 'Lost' : 'Abandoned';
}

export function legacyRunOutcomeTitle(outcome: RunOutcome): string {
  if (outcome === 'Completed') return t('legacy.runComplete');
  return outcome === 'Lost' ? t('legacy.runLost') : t('legacy.runAbandoned');
}

// The caller pauses first; a tick batch still in flight would otherwise commit over the reset that follows.
export async function legacyEndRun(): Promise<GameId | undefined> {
  await waitForGameloopIdle();

  let run: RunRecord;
  try {
    run = legacyRunFromGame(legacyRunOutcome());
    legacyRecordRun(run);
    analyticsSendDesignEvent(`Legacy:EndRun:${run.outcome}`);
  } catch (e) {
    error('Legacy', 'Failed to record the run:', e);
    notifyError(t('legacy.couldNotSaveThis'));
    return undefined;
  }

  achievementsCheckRun(run);
  return run.id;
}

// A run ended since the newest backup explains the missing save, even if that backup's game was replaced rather than ended.
export function legacyHasUnfinishedBackup(backups: SavefileBackup[]): boolean {
  const newest = backups[0];
  return (
    !!newest &&
    !legacyRunById(newest.gameId as GameId) &&
    !legacy().runs.some((run) => run.endedAt > newest.createdAt)
  );
}

export function legacyHasCompletedRun(): boolean {
  return legacy().runs.some((run) => run.outcome === 'Completed');
}

// Only runs that ended before `endedBefore`, so a reopened summary compares against the best as it stood then.
export function legacyBestTimedRun(
  endedBefore = Infinity,
): RunRecord | undefined {
  return minBy(
    legacy().runs.filter(
      (run) =>
        run.outcome === 'Completed' &&
        run.timed === true &&
        run.endedAt < endedBefore,
    ),
    (run) => run.ticks,
  );
}

export function legacyClearedEdictIds(): EdictId[] {
  return legacyRunsClearedEdictIds(legacy().runs);
}

// Copied once at world setup, so the edict reward stock can't change mid-run.
export async function legacyClearedEdictsCopyToRun(): Promise<void> {
  const cleared = legacyClearedEdictIds();
  await updateGamestate((state) => {
    state.legacyClearedEdicts = cleared;
    return state;
  });
}

export function legacyHeroStatRows(stats: HeroRunStats): RunStatRow[] {
  return [
    { label: t('legacy.heroStat.kills'), value: stats.kills },
    { label: t('legacy.heroStat.damageDealt'), value: stats.damageDealt },
    { label: t('legacy.heroStat.damageTaken'), value: stats.damageTaken },
    { label: t('legacy.heroStat.healing'), value: stats.healing },
    { label: t('legacy.heroStat.damageBlocked'), value: stats.damageBlocked },
    { label: t('legacy.heroStat.crits'), value: stats.crits },
    {
      label: t('legacy.heroStat.statusEffectsApplied'),
      value: stats.statusEffectsApplied,
    },
    { label: t('legacy.heroStat.deaths'), value: stats.deaths },
    { label: t('legacy.heroStat.fights'), value: stats.fights },
  ];
}

export function legacyHeroMostUsedSkill(
  stats: HeroRunStats,
): RunMostUsedSkill | undefined {
  const top = maxBy(Object.entries(stats.skillUses), ([, uses]) => uses);
  return top ? { skillFamily: top[0], uses: top[1] } : undefined;
}

const RUN_AWARDS: RunAwardDefinition[] = [
  { labelKey: 'legacy.award.mostDamage', value: (stats) => stats.damageDealt },
  { labelKey: 'legacy.award.mostHealing', value: (stats) => stats.healing },
  {
    labelKey: 'legacy.award.mostDamageTaken',
    value: (stats) => stats.damageTaken,
  },
  { labelKey: 'legacy.award.mostDeaths', value: (stats) => stats.deaths },
  {
    labelKey: 'legacy.award.biggestHit',
    value: (stats) => stats.biggestHit?.amount ?? 0,
  },
  { labelKey: 'legacy.award.mostCrits', value: (stats) => stats.crits },
];

// Worked out on render, not stored, so tuning awards also updates old runs. A solo hero would win everything, so they get none.
export function legacyRunAwards(run: RunRecord): RunAward[] {
  if (run.party.length < 2) return [];

  return RUN_AWARDS.flatMap((award) => {
    const values = run.party.map((hero) =>
      hero.stats ? award.value(hero.stats) : 0,
    );
    const top = Math.max(...values);
    // indexOf keeps ties with the hero listed first.
    return top > 0
      ? [{ label: t(award.labelKey), heroIndex: values.indexOf(top) }]
      : [];
  });
}
