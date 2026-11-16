import { describe, expect, it } from 'vitest';

import {
  achievementEdictsCleared,
  achievementRunEarner,
  achievementRunMatches,
} from '@helpers/achievement/achievement-run';
import { ensureEdict } from '@helpers/content/ensure-edict';
import type {
  AchievementConditionCompleteRun,
  EdictId,
  GameId,
  HeroRunStats,
  JobId,
  RunRecordHero,
} from '@interfaces';
import { buildRunRecord } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const boon = ensureEdict({ id: 'boon' as EdictId, name: 'Boon', kind: 'Boon' });
const challenge = ensureEdict({
  id: 'challenge' as EdictId,
  name: 'Challenge',
  kind: 'Challenge',
});

function hero(jobId: string, stats?: Partial<HeroRunStats>): RunRecordHero {
  return {
    name: 'Hero',
    jobId: jobId as JobId,
    level: 1,
    stats: stats
      ? {
          kills: 0,
          damageDealt: 0,
          damageTaken: 0,
          deaths: 0,
          healing: 0,
          crits: 0,
          statusEffectsApplied: 0,
          damageBlocked: 0,
          fights: 0,
          skillUses: {},
          ...stats,
        }
      : undefined,
  };
}

const trackedStats = {
  kills: 0,
  monstersKilled: 0,
  mapsReached: 0,
  townsVisited: 0,
  completion: [],
  run: {
    trackedFromTick: 0,
    goldEarned: 0,
    fightsWon: 0,
    fightsLost: 0,
    itemsCrafted: 0,
  },
};

describe('achievementRunMatches', () => {
  it('only counts runs where Fel fell', () => {
    expect(achievementRunMatches(buildRunRecord({ outcome: 'Lost' }), {})).toBe(
      false,
    );
    expect(achievementRunMatches(buildRunRecord(), {})).toBe(true);
  });

  it('leaves boons out of the non-boon edict count', () => {
    seedContent([boon, challenge]);
    const run = buildRunRecord({ edicts: [boon.id, challenge.id] });

    expect(achievementRunMatches(run, { minEdicts: 2 })).toBe(true);
    expect(achievementRunMatches(run, { minNonBoonEdicts: 2 })).toBe(false);
    expect(achievementRunMatches(run, { minNonBoonEdicts: 1 })).toBe(true);
  });

  it('requires every listed edict and none of the excluded ones', () => {
    const run = buildRunRecord({ edicts: [challenge.id], fragments: 6 });

    expect(achievementRunMatches(run, { edictIds: [challenge.id] })).toBe(true);
    expect(
      achievementRunMatches(run, { edictIds: [challenge.id, boon.id] }),
    ).toBe(false);
    expect(
      achievementRunMatches(run, { excludedEdictIds: [challenge.id] }),
    ).toBe(false);
    expect(achievementRunMatches(run, { minFragments: 6 })).toBe(true);
    expect(achievementRunMatches(run, { minFragments: 7 })).toBe(false);
  });

  it('checks the party for size and a shared job', () => {
    const run = buildRunRecord({
      party: [hero('a'), hero('a'), hero('a'), hero('a')],
    });

    expect(achievementRunMatches(run, { minPartySize: 4, sameJob: true })).toBe(
      true,
    );
    expect(
      achievementRunMatches(
        buildRunRecord({ party: [hero('a'), hero('b'), hero('a'), hero('a')] }),
        { sameJob: true },
      ),
    ).toBe(false);
  });

  it('finds a one-trick hero, judging other skills apart from the fallback Attack', () => {
    const run = (skillUses: Record<string, number>) =>
      buildRunRecord({
        party: [hero('a', { skillUses })],
        stats: trackedStats,
      });

    const isOneTrick = (skillUses: Record<string, number>) =>
      achievementRunMatches(run(skillUses), { heroFeat: 'OneTrick' });

    expect(isOneTrick({ Attack: 96, Fire: 4 })).toBe(true);
    expect(isOneTrick({ Attack: 500, Fire: 96, Ice: 4 })).toBe(true);
    expect(isOneTrick({ Attack: 60, Fire: 30, Ice: 10 })).toBe(false);
    expect(isOneTrick({ Fire: 90, Ice: 10 })).toBe(false);
    expect(isOneTrick({ Fire: 20 })).toBe(false);
  });

  it('finds a pacifist healer who still took lives', () => {
    const run = (kills: number) =>
      buildRunRecord({
        party: [hero('a', { healing: 500, damageDealt: 100, kills })],
        stats: trackedStats,
      });

    expect(achievementRunMatches(run(10), { heroFeat: 'PacifistHealer' })).toBe(
      true,
    );
    expect(achievementRunMatches(run(2), { heroFeat: 'PacifistHealer' })).toBe(
      false,
    );
  });

  it('skips hero feats on runs whose stats started late', () => {
    const run = buildRunRecord({
      party: [hero('a', { healing: 500, kills: 50 })],
      stats: {
        ...trackedStats,
        run: { ...trackedStats.run, trackedFromTick: 9 },
      },
    });

    expect(achievementRunMatches(run, { heroFeat: 'PacifistHealer' })).toBe(
      false,
    );
  });
});

describe('achievementRunMatches maxFelTick', () => {
  it('needs Fel to fall by the limit, and an untracked tick never counts', () => {
    const run = (felDefeatedTick?: number) =>
      buildRunRecord({
        stats: {
          ...trackedStats,
          run: { ...trackedStats.run, felDefeatedTick },
        },
      });

    expect(achievementRunMatches(run(100), { maxFelTick: 100 })).toBe(true);
    expect(achievementRunMatches(run(101), { maxFelTick: 100 })).toBe(false);
    expect(achievementRunMatches(run(), { maxFelTick: 100 })).toBe(false);
  });
});

describe('achievementRunMatches party history', () => {
  const withJobs = (...jobsUsed: string[][]) =>
    buildRunRecord({
      party: jobsUsed.map((used) => ({
        ...hero(used[0]),
        snapshot: { jobsUsed: used as JobId[] },
      })),
    });

  it('needs every hero to keep one job for no reclassing', () => {
    expect(
      achievementRunMatches(withJobs(['a'], ['b']), { noReclass: true }),
    ).toBe(true);
    expect(
      achievementRunMatches(withJobs(['a'], ['b', 'c']), { noReclass: true }),
    ).toBe(false);
    expect(
      achievementRunMatches(buildRunRecord({ party: [hero('a')] }), {
        noReclass: true,
      }),
    ).toBe(false);
  });

  it('rules out a job any hero ever served in', () => {
    const excludedJobIds = ['healer' as JobId];

    expect(
      achievementRunMatches(withJobs(['a'], ['b']), { excludedJobIds }),
    ).toBe(true);
    expect(
      achievementRunMatches(withJobs(['a'], ['b', 'healer']), {
        excludedJobIds,
      }),
    ).toBe(false);
  });
});

describe('achievementRunMatches boons and deaths', () => {
  it('rejects any boon when boons are ruled out', () => {
    seedContent([boon, challenge]);

    expect(
      achievementRunMatches(buildRunRecord({ edicts: [challenge.id] }), {
        noBoons: true,
      }),
    ).toBe(true);
    expect(
      achievementRunMatches(buildRunRecord({ edicts: [boon.id] }), {
        noBoons: true,
      }),
    ).toBe(false);
  });

  it('needs tracked stats with no deaths at all', () => {
    const run = (deaths: number, trackedFromTick = 0) =>
      buildRunRecord({
        party: [hero('a', { deaths }), hero('b', {})],
        stats: {
          ...trackedStats,
          run: { ...trackedStats.run, trackedFromTick },
        },
      });

    expect(achievementRunMatches(run(0), { noDeaths: true })).toBe(true);
    expect(achievementRunMatches(run(1), { noDeaths: true })).toBe(false);
    expect(achievementRunMatches(run(0, 9), { noDeaths: true })).toBe(false);
  });
});

describe('achievementRunMatches party at Fel', () => {
  it('judges the party as Fel fell, not the one the run ended with', () => {
    const run = buildRunRecord({
      party: [hero('a'), hero('a')],
      stats: {
        ...trackedStats,
        run: { ...trackedStats.run, felParty: [hero('a'), hero('b')] },
      },
    });

    expect(achievementRunMatches(run, { sameJob: true })).toBe(false);
  });
});

describe('achievementRunEarner', () => {
  it('is the run that reached the count, by finish time', () => {
    const condition: AchievementConditionCompleteRun = {
      type: 'CompleteRun',
      count: 2,
    };
    const runs = [
      buildRunRecord({ id: 'late' as GameId, endedAt: 30 }),
      buildRunRecord({ id: 'lost' as GameId, endedAt: 5, outcome: 'Lost' }),
      buildRunRecord({ id: 'first' as GameId, endedAt: 10 }),
      buildRunRecord({ id: 'second' as GameId, endedAt: 20 }),
    ];

    expect(achievementRunEarner(condition, runs)?.id).toBe('second');
    expect(achievementRunEarner(condition, runs.slice(0, 2))).toBeUndefined();
  });
});

describe('achievementEdictsCleared', () => {
  it('counts edicts of the kind held in any Completed run', () => {
    const other = ensureEdict({
      id: 'other' as EdictId,
      name: 'Other',
      kind: 'Challenge',
    });
    seedContent([boon, challenge, other]);
    const runs = [
      buildRunRecord({ edicts: [challenge.id, boon.id] }),
      buildRunRecord({ edicts: [other.id], outcome: 'Lost' }),
    ];

    expect(
      achievementEdictsCleared(
        { type: 'ClearEdicts', kind: 'Challenge' },
        runs,
      ),
    ).toEqual({ current: 1, max: 2 });
  });
});
