/**
 * Reports monster stats at a given level, for every monster or a chosen
 * subset - a companion to `analyze-herostats` for checking a monster (or
 * encounter roster) against what a party could plausibly have at that
 * level.
 *
 * Stat formula mirrors `monsterStatsAtLevel` in
 * `src/app/helpers/combat-create.ts`: `baseStats[stat] + statsPerLevel[stat] * (level - 1)`.
 * Monsters have no equipment, so there's only one stat block per monster
 * per level (no min/mid/max split like the hero script).
 *
 * Usage: ts-node scripts/analyze-monsterstats <level 1-99> [monster1,monster2,...]
 *
 * The monster list is optional and matches `Monster.name` case-insensitively
 * (e.g. `goblin,goblin warrior`); omit it to report every monster.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const MONSTER_DIR = path.join(ROOT_DIR, 'gamedata', 'monster');

// Monsters aren't bound by CHARACTER_MAX_LEVEL, but there's no reason for
// an encounter to be authored above it either - reuse the same ceiling
// (see CHARACTER_MAX_LEVEL in src/app/helpers/party.ts) as a sanity bound.
const MAX_LEVEL = 99;

const STATS = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
] as const;
type Stat = (typeof STATS)[number];
type StatBlock = Record<Stat, number>;

type Monster = {
  name: string;
  rarity: string;
  targettingType: string;
  baseStats: StatBlock;
  statsPerLevel: StatBlock;
};

async function loadYmlArray<T>(dir: string): Promise<T[]> {
  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const entries: T[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as T[] | undefined;
    entries.push(...(doc ?? []));
  });
  return entries;
}

function statSum(stats: StatBlock): number {
  return STATS.reduce((sum, stat) => sum + stats[stat], 0);
}

function monsterStatsAtLevel(monster: Monster, level: number): StatBlock {
  const stats = { ...monster.baseStats };
  STATS.forEach((stat) => {
    stats[stat] += (monster.statsPerLevel[stat] ?? 0) * (level - 1);
  });
  return stats;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Case-insensitive filter by `name` - returns every item if `namesArg` is
// omitted/empty.
function filterByNames<T extends { name: string }>(
  items: T[],
  namesArg: string | undefined,
): T[] {
  if (!namesArg) return items;

  const wanted = namesArg.split(',').map((name) => name.trim().toLowerCase());
  return items.filter((item) => wanted.includes(item.name.toLowerCase()));
}

function statRow(monster: Monster, stats: StatBlock): Record<string, number | string> {
  const row: Record<string, number | string> = {
    Rarity: monster.rarity,
    Targetting: monster.targettingType,
  };
  STATS.forEach((stat) => {
    row[stat] = round2(stats[stat]);
  });
  row['Total'] = round2(statSum(stats));
  return row;
}

async function main(): Promise<void> {
  const level = Number(process.argv[2]);
  const monsterFilterArg = process.argv[3];

  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    console.error(
      `Usage: ts-node scripts/analyze-monsterstats <level 1-${MAX_LEVEL}> [monster1,monster2,...]`,
    );
    process.exit(1);
  }

  const monsters = await loadYmlArray<Monster>(MONSTER_DIR);

  const selectedMonsters = filterByNames(monsters, monsterFilterArg);
  if (selectedMonsters.length === 0) {
    console.error(
      `No monsters matched "${monsterFilterArg}". Available monsters: ${monsters.map((monster) => monster.name).join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`=== Monster stats at level ${level} ===\n`);

  const table: Record<string, Record<string, number | string>> = {};
  selectedMonsters.forEach((monster) => {
    const stats = monsterStatsAtLevel(monster, level);
    table[monster.name] = statRow(monster, stats);
  });

  console.table(table);
}

main();
