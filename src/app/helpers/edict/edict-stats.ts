import {
  monsterSkillsAtLevel,
  monsterStatsAtLevel,
} from '@helpers/combat/monster';
import { regionForMap } from '@helpers/lore/region-intro';
import { rngShuffle } from '@helpers/rng';
import {
  globalEffectSumsState,
  worldCurrentLocationState,
} from '@helpers/state-game';
import type {
  GameStat,
  MonsterContent,
  MonsterSkill,
  StatBlock,
} from '@interfaces';

const PERCENT_ROUNDED_STATS: GameStat[] = ['Health', 'Energy'];

export function statsScaledByPercent(
  stats: StatBlock,
  percents: StatBlock,
): StatBlock {
  const scaled = { ...stats };

  (Object.keys(scaled) as GameStat[]).forEach((stat) => {
    if (percents[stat] === 0) return;
    const value = scaled[stat] * (1 + percents[stat] / 100);
    // Pools round so current/max HP and EP stay whole; rounding small stats would swallow the percent.
    scaled[stat] = PERCENT_ROUNDED_STATS.includes(stat)
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
    globalEffectSumsState().enemyStatPercents,
  );
}

// Extra skills come from the region the party is fighting in, never one the monster already has.
export function monsterSkillsForRun(
  monster: MonsterContent,
  level: number,
): MonsterSkill[] {
  const skills = monsterSkillsAtLevel(monster, level);
  const extra = globalEffectSumsState().enemyExtraSkills;
  if (extra <= 0) return skills;

  const known = skills.map((skill) => skill.skillId);
  const pool = (
    regionForMap(worldCurrentLocationState().mapName)?.skillPool ?? []
  ).filter(
    (skill) =>
      skill.minLevel <= level &&
      skill.maxLevel >= level &&
      !known.includes(skill.skillId),
  );
  return [...skills, ...rngShuffle(pool).slice(0, extra)];
}
