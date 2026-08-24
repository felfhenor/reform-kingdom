import { rngChoiceWeighted, rngNumberRange } from '@helpers/rng';
import type {
  EncounterFightMonster,
  EncounterRandomContent,
  EncounterRandomFight,
  MonsterId,
} from '@interfaces';

// 0 for the first fight, 1 for the last - drives both level and combatant
// count so the generated sequence trends from easy to hard.
function fightDifficulty(index: number, total: number): number {
  return total > 1 ? index / (total - 1) : 1;
}

function lerpRange(range: { min: number; max: number }, t: number): number {
  return Math.round(range.min + (range.max - range.min) * t);
}

function rollFightMonster(
  content: EncounterRandomContent,
): EncounterFightMonster {
  const picked = rngChoiceWeighted(content.creaturePool, (m) => m.weight);
  return { monsterId: picked?.monsterId ?? ('UNKNOWN' as MonsterId) };
}

function buildEncounterRandomFight(
  content: EncounterRandomContent,
  index: number,
  total: number,
): EncounterRandomFight {
  const difficulty = fightDifficulty(index, total);
  const level = lerpRange(content.levelRange, difficulty);
  const combatantCount = Math.max(
    1,
    lerpRange(content.combatantRange, difficulty),
  );

  const monsters = Array.from({ length: combatantCount }, () =>
    rollFightMonster(content),
  );

  return { level, monsters };
}

export function generateEncounterRandomFights(
  content: EncounterRandomContent,
): EncounterRandomFight[] {
  const fightCount = rngNumberRange(
    content.encounterRange.min,
    content.encounterRange.max + 1,
  );

  return Array.from({ length: fightCount }, (_, i) =>
    buildEncounterRandomFight(content, i, fightCount),
  );
}
