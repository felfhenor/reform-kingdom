import { mean, sumBy } from 'es-toolkit/compat';
import fs from 'fs-extra';
import path from 'path';
import { TICKS_PER_HOUR } from './constants';
import type { SimResult, StonewallKind } from './types';

type GroupSummary = {
  comp: string;
  strategy: string;
  trials: number;
  maxLevelCount: number;
  tickBudgetCount: number;
  stonewallCount: number;
  avgFinalTick: number;
  avgFinalPartyLevel: number;
  hardStonewalls: number;
  xpDecays: number;
  supplyStalls: number;
  isChokePoint: boolean;
};

function groupKey(result: SimResult): string {
  return `${result.scenario.comp.label} ${result.scenario.strategy}`;
}

function countStonewallKind(results: SimResult[], kind: StonewallKind): number {
  return sumBy(
    results,
    (r) => r.stonewalls.filter((s) => s.kind === kind).length,
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(mean(values));
}

// One row per (party comp x strategy): success rate, average progress, and
// stonewall frequency by kind - a comp whose every trial ends in
// `HardStonewall` regardless of strategy is a "consistent choke point"
export function summarizeResults(results: SimResult[]): GroupSummary[] {
  const groups = new Map<string, SimResult[]>();
  results.forEach((result) => {
    const key = groupKey(result);
    const existing = groups.get(key) ?? [];
    existing.push(result);
    groups.set(key, existing);
  });

  return [...groups.values()].map((groupResults) => {
    const first = groupResults[0];
    const stonewallCount = groupResults.filter(
      (r) => r.terminalReason === 'Stonewall',
    ).length;

    return {
      comp: first.scenario.comp.label,
      strategy: first.scenario.strategy,
      trials: groupResults.length,
      maxLevelCount: groupResults.filter((r) => r.terminalReason === 'MaxLevel')
        .length,
      tickBudgetCount: groupResults.filter(
        (r) => r.terminalReason === 'TickBudget',
      ).length,
      stonewallCount,
      avgFinalTick: average(groupResults.map((r) => r.finalTick)),
      avgFinalPartyLevel: average(groupResults.map((r) => r.finalPartyLevel)),
      hardStonewalls: countStonewallKind(groupResults, 'HardStonewall'),
      xpDecays: countStonewallKind(groupResults, 'XpDecay'),
      supplyStalls: countStonewallKind(groupResults, 'SupplyStall'),
      // Every trial for this comp x strategy hit a hard stonewall - not an
      // occasional unlucky run.
      isChokePoint: stonewallCount === groupResults.length,
    };
  });
}

export function printSummaryTable(summaries: GroupSummary[]): void {
  console.table(
    summaries.map((s) => ({
      Comp: s.comp,
      Strategy: s.strategy,
      Trials: s.trials,
      'Max Level': s.maxLevelCount,
      'Tick Budget': s.tickBudgetCount,
      Stonewalled: s.stonewallCount,
      'Avg Final Tick': s.avgFinalTick,
      'Avg Final Level': s.avgFinalPartyLevel,
      'Choke Point?': s.isChokePoint ? 'YES' : '',
    })),
  );
}

export function writeSummaryFiles(
  logDir: string,
  summaries: GroupSummary[],
  verbose = false,
): void {
  const jsonPath = path.join(logDir, 'summary.json');
  fs.writeJsonSync(jsonPath, summaries, { spaces: 2 });
  if (verbose) console.log(`This file has been written: ${jsonPath}`);

  const header =
    '| Comp | Strategy | Trials | Max Level | Tick Budget | Stonewalled | Avg Final Tick | Avg Final Level | Choke Point |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
  const rows = summaries
    .map(
      (s) =>
        `| ${s.comp} | ${s.strategy} | ${s.trials} | ${s.maxLevelCount} | ${s.tickBudgetCount} | ${s.stonewallCount} | ${s.avgFinalTick} | ${s.avgFinalPartyLevel} | ${s.isChokePoint ? 'YES' : ''} |`,
    )
    .join('\n');

  const mdPath = path.join(logDir, 'summary.md');
  fs.writeFileSync(mdPath, header + rows + '\n');
  if (verbose) console.log(`This file has been written: ${mdPath}`);
}

// One row per individual (comp x strategy x trial) run - unlike
// `GroupSummary` (averaged across trials), this is every run on its own, so
// specific outlier comp/strategy pairs can be picked out directly rather
// than hidden inside an average.
export type LeaderboardRow = {
  comp: string;
  strategy: string;
  trial: number;
  terminalReason: SimResult['terminalReason'];
  finalTick: number;
  simulatedHours: number;
  finalPartyLevel: number;
  stonewallKinds: string;
};

function stonewallKindsLabel(result: SimResult): string {
  if (result.stonewalls.length === 0) return '-';
  return [...new Set(result.stonewalls.map((s) => s.kind))].join(', ');
}

// Ranked highest party level first (fastest tiebreak second) so the best-
// performing comp/strategy pairs - the "optimal paths" - sort to the top,
// and whatever stalled out at the lowest level sorts to the bottom, ready to
// investigate as a balance target.
export function buildLeaderboard(results: SimResult[]): LeaderboardRow[] {
  return results
    .map((result) => ({
      comp: result.scenario.comp.label,
      strategy: result.scenario.strategy,
      trial: result.scenario.trial,
      terminalReason: result.terminalReason,
      finalTick: result.finalTick,
      simulatedHours:
        Math.round((result.finalTick / TICKS_PER_HOUR) * 100) / 100,
      finalPartyLevel: result.finalPartyLevel,
      stonewallKinds: stonewallKindsLabel(result),
    }))
    .sort(
      (a, b) =>
        b.finalPartyLevel - a.finalPartyLevel || a.finalTick - b.finalTick,
    );
}

export function printLeaderboard(rows: LeaderboardRow[]): void {
  console.log('\nLeaderboard (best progress first):');
  console.table(
    rows.map((r, i) => ({
      Rank: i + 1,
      Comp: r.comp,
      Strategy: r.strategy,
      Trial: r.trial,
      Result: r.terminalReason,
      'Final Tick': r.finalTick,
      'Sim Hours': r.simulatedHours,
      'Final Level': r.finalPartyLevel,
      Stonewalls: r.stonewallKinds,
    })),
  );
}

export function writeLeaderboardFiles(
  logDir: string,
  rows: LeaderboardRow[],
  verbose = false,
): void {
  const jsonPath = path.join(logDir, 'leaderboard.json');
  fs.writeJsonSync(jsonPath, rows, { spaces: 2 });
  if (verbose) console.log(`This file has been written: ${jsonPath}`);

  const header =
    '| Rank | Comp | Strategy | Trial | Result | Final Tick | Sim Hours | Final Level | Stonewalls |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
  const body = rows
    .map(
      (r, i) =>
        `| ${i + 1} | ${r.comp} | ${r.strategy} | ${r.trial} | ${r.terminalReason} | ${r.finalTick} | ${r.simulatedHours} | ${r.finalPartyLevel} | ${r.stonewallKinds} |`,
    )
    .join('\n');

  const mdPath = path.join(logDir, 'leaderboard.md');
  fs.writeFileSync(mdPath, header + body + '\n');
  if (verbose) console.log(`This file has been written: ${mdPath}`);
}
