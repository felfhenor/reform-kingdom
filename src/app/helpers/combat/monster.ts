import { getEntry } from '@helpers/content';
import { rangeAtLevel } from '@helpers/engine/leveled-range';
import { rngNumberRange } from '@helpers/rng';
import type { EncounterFightMonster, MonsterContent, StatBlock } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// A monster's stats at a given level - `baseStats` is its level-1 block,
// scaled up by `statsPerLevel` for every level past 1.
export function monsterStatsAtLevel(
  monster: MonsterContent,
  level: number,
): StatBlock {
  const stats = { ...monster.baseStats };

  (Object.keys(stats) as Array<keyof StatBlock>).forEach((stat) => {
    stats[stat] += monster.statsPerLevel[stat] * (level - 1);
  });

  return stats;
}

export function monsterXpReward(
  monster: MonsterContent,
  level: number,
): number {
  const range = rangeAtLevel(monster.xp, level);
  return rngNumberRange(range.min, range.max);
}

// XP degrades once the party out-levels a node's max, bottoming out at a flat 1 XP - keeps overleveled parties from farming trivial nodes.
const OVERLEVEL_XP_DEGRADE_PER_LEVEL = 0.25;
const OVERLEVEL_XP_HARD_CAP_LEVELS = 4;
const OVERLEVEL_XP_HARD_CAP_AMOUNT = 1;

export function xpForOverLevel(
  rawXp: number,
  partyLevel: number,
  nodeMaxLevel: number,
): number {
  const levelsOverCap = partyLevel - nodeMaxLevel;
  if (levelsOverCap <= 0) return rawXp;
  if (levelsOverCap >= OVERLEVEL_XP_HARD_CAP_LEVELS) {
    return OVERLEVEL_XP_HARD_CAP_AMOUNT;
  }

  const multiplier = 1 - OVERLEVEL_XP_DEGRADE_PER_LEVEL * levelsOverCap;
  return Math.max(
    OVERLEVEL_XP_HARD_CAP_AMOUNT,
    Math.round(rawXp * multiplier),
  );
}

// Lets a node be judged not worth the trip before any fight happens (see `mostChallengingExploreNodeForRisk`), rather than only after.
export function isXpTrivialAtOverLevel(
  partyLevel: number,
  nodeMaxLevel: number,
): boolean {
  return partyLevel - nodeMaxLevel >= OVERLEVEL_XP_HARD_CAP_LEVELS;
}

// Shared by authored Encounters and generated ExploreRandom fights; sorted alphabetically for the map node panel's monster tooltip.
export function monstersFromFights(
  fights: Array<{ monsters: EncounterFightMonster[] }>,
): MonsterContent[] {
  const seen = new Set<string>();
  const monsters: MonsterContent[] = [];

  fights.forEach((fight) => {
    fight.monsters.forEach(({ monsterId }) => {
      if (seen.has(monsterId)) return;

      const monster = getEntry<MonsterContent>(monsterId);
      if (!monster) return;

      seen.add(monsterId);
      monsters.push(monster);
    });
  });

  return sortBy(monsters, (monster) => monster.name);
}
