import { monsterStatsAtLevel } from '@helpers/combat/monster';
import { defaultStats } from '@helpers/defaults';
import { edictsActive } from '@helpers/edict/edict';
import type {
  EdictStatTarget,
  GameStat,
  MonsterContent,
  StatBlock,
} from '@interfaces';

const EDICT_ROUNDED_STATS: GameStat[] = ['Health', 'Energy'];

export function edictStatPercents(target: EdictStatTarget): StatBlock {
  const percents = defaultStats();
  const stats = Object.keys(percents) as GameStat[];

  edictsActive()
    .flatMap((edict) => edict.effects ?? [])
    .filter((effect) => effect.target === target)
    .forEach((effect) => {
      (effect.stat ? [effect.stat] : stats).forEach((stat) => {
        percents[stat] += effect.percent;
      });
    });

  return percents;
}

export function statsScaledByPercent(
  stats: StatBlock,
  percents: StatBlock,
): StatBlock {
  const scaled = { ...stats };

  (Object.keys(scaled) as GameStat[]).forEach((stat) => {
    if (percents[stat] === 0) return;
    const value = scaled[stat] * (1 + percents[stat] / 100);
    // Pools round so current/max HP and EP stay whole; rounding small stats would swallow the percent.
    scaled[stat] = EDICT_ROUNDED_STATS.includes(stat)
      ? Math.round(value)
      : value;
  });

  return scaled;
}

// Kept out of the monster helpers: analysis scripts import those and must not read gamestate.
export function monsterStatsForRun(
  monster: MonsterContent,
  level: number,
): StatBlock {
  return statsScaledByPercent(
    monsterStatsAtLevel(monster, level),
    edictStatPercents('Enemy'),
  );
}
