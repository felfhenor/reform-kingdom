import {
  SCORE_COMPLETION_POINTS,
  SCORE_SEAL_POINTS,
  SCORE_SEAL_SPEED_POINTS,
} from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import type {
  RegionContent,
  RunRecord,
  RunScore,
  RunScoreSeal,
} from '@interfaces';
import { clamp, sumBy } from 'es-toolkit/compat';

// Measured from the run's start, so a region sealed out of order is judged on its own par.
function legacySealSpeedPoints(tick: number, parTicks: number): number {
  if (parTicks <= 0) return 0;
  const underPar = clamp((parTicks - tick) / parTicks, 0, 1);
  return Math.floor(SCORE_SEAL_SPEED_POINTS * underPar);
}

function legacyRunSeals(run: RunRecord): RunScoreSeal[] {
  const seals = run.stats.run?.seals ?? {};

  return getEntriesByType<RegionContent>('region').flatMap((region) => {
    const tick = seals[region.id];
    return tick === undefined
      ? []
      : [
          {
            region,
            tick,
            sealPoints: SCORE_SEAL_POINTS,
            speedPoints: legacySealSpeedPoints(tick, region.seal.parTicks),
          },
        ];
  });
}

// Worked out on render from current content, so a balance pass re-scores old runs; only the multiplier is kept as it was.
export function legacyRunScore(run: RunRecord): RunScore {
  const seals = legacyRunSeals(run);
  const completion =
    run.stats.run && run.outcome === 'Completed' ? SCORE_COMPLETION_POINTS : 0;
  const base =
    sumBy(seals, (seal) => seal.sealPoints + seal.speedPoints) + completion;

  return {
    sealsTracked: run.stats.run?.seals !== undefined,
    seals,
    completion,
    base,
    multiplier: run.multiplier,
    total: Math.floor(base * run.multiplier),
  };
}

// Empty when seals weren't tracked, so an old run doesn't look like it sealed nothing.
export function legacyUnsealedRegions(run: RunRecord): RegionContent[] {
  const seals = run.stats.run?.seals;
  if (!seals) return [];

  return getEntriesByType<RegionContent>('region').filter(
    (region) => seals[region.id] === undefined,
  );
}
