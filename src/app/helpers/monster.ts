import { getEntry } from '@helpers/content';
import { rngNumberRange } from '@helpers/rng';
import type { EncounterFightMonster, MonsterContent } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function monsterXpReward(
  monster: MonsterContent,
  level: number,
): number {
  const levelBonus = monster.xp.multiplierPerLevel * (level - 1);
  return rngNumberRange(
    monster.xp.min + levelBonus,
    monster.xp.max + levelBonus + 1,
  );
}

// Explore nodes advertise a level range (e.g. "3-5") as their recommended
// difficulty, with the max acting as a soft cap. Once the party out-levels
// it, XP degrades 25% per level over cap, bottoming out at a flat 1 XP once
// 4+ levels over - keeps overleveled parties from farming trivial nodes for
// full XP.
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

// De-dupes and resolves the monsters referenced across a node's fights (used
// by both authored Encounters and generated ExploreRandom fights, which
// share the same `{ monsters: EncounterFightMonster[] }` shape), sorted
// alphabetically for display in the map node panel's monster tooltip.
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
