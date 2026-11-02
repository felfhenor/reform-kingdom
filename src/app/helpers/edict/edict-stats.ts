import { monsterStatsAtLevel } from '@helpers/combat/monster';
import { defaultStats } from '@helpers/defaults';
import { edictsActive } from '@helpers/edict/edict';
import type {
  EdictStatTarget,
  GameStat,
  MonsterContent,
  StatBlock,
} from '@interfaces';

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

  // Not rounded: hero stats are already fractional, and rounding would change them with no edicts.
  (Object.keys(scaled) as GameStat[]).forEach((stat) => {
    scaled[stat] *= 1 + percents[stat] / 100;
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
