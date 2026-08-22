/**
 * Reports monster stats at a given level, for every monster or a chosen
 * subset - a companion to `analysis-herostats.ts`. Ported from
 * `scripts/analyze-monsterstats.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import { filterByNames, round2, statSum } from '@helpers/debug/analysis-utils';
import type {
  AnalysisParams,
  AnalysisRunResult,
  AnalysisTable,
  MonsterContent,
  StatBlock,
} from '@interfaces';

const MAX_LEVEL = 99;

const STAT_NAMES = [
  'Intelligence',
  'Strength',
  'Vitality',
  'Resistance',
  'Agility',
  'Health',
  'Energy',
  'Luck',
] as const;

function monsterStatsAtLevel(monster: MonsterContent, level: number): StatBlock {
  const stats = { ...monster.baseStats };
  STAT_NAMES.forEach((stat) => {
    stats[stat] += (monster.statsPerLevel[stat] ?? 0) * (level - 1);
  });
  return stats;
}

export function runMonsterStatsAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const level = Number(params['level'] ?? 50);
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(
      `"level" must be an integer between 1 and ${MAX_LEVEL}, got ${params['level']}.`,
    );
  }

  const monsters = getEntriesByType<MonsterContent>('monster');
  const selectedMonsters = filterByNames(
    monsters,
    params['monsterFilter'] as string[] | undefined,
  );

  if (selectedMonsters.length === 0) {
    throw new Error(
      `No monsters matched "${params['monsterFilter']}". Available monsters: ${monsters.map((m) => m.name).join(', ')}`,
    );
  }

  const rows = selectedMonsters.map((monster) => {
    const stats = monsterStatsAtLevel(monster, level);
    const row: Record<string, string | number> = {
      Monster: monster.name,
      Rarity: monster.rarity,
      Targetting: monster.targettingType,
    };
    STAT_NAMES.forEach((stat) => {
      row[stat] = round2(stats[stat]);
    });
    row['Total'] = round2(statSum(stats));
    return row;
  });

  const table: AnalysisTable = {
    title: `Monster stats at level ${level}`,
    columns: ['Monster', 'Rarity', 'Targetting', ...STAT_NAMES, 'Total'],
    rows,
  };

  return {
    checks: [],
    tables: [table],
    summary: `Reported stats for ${selectedMonsters.length} monster(s) at level ${level}.`,
  };
}
