/**
 * Shared console-printing/exit-code behavior for the thin CLI wrappers
 * under `scripts/analyze-*.ts` / `scripts/validate-*.ts`. Mirrors the
 * ✓/✗/`::error::`/`process.exit(1)` conventions the pre-dashboard versions
 * of these scripts used, so CI and local usage behave the same.
 * `--expanded` prints individual `pass` checks (mirrors the `/debug` dashboard's toggle of the same name).
 */

import type { AnalysisRunResult, AnalysisTable } from '@interfaces';

const STATUS_ICON: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  warning: '⚠',
  info: '-',
};

function printTable(table: AnalysisTable): void {
  console.log(`\n--- ${table.title} ---`);

  const labelColumn = table.columns[0];
  const keyed: Record<string, Record<string, string | number>> = {};

  table.rows.forEach((row, index) => {
    const { [labelColumn]: label, ...rest } = row;
    keyed[label !== undefined ? String(label) : `#${index + 1}`] = rest;
  });

  console.table(keyed);
}

export function printAnalysisResult(
  title: string,
  result: AnalysisRunResult,
  options: { strict: boolean },
): void {
  const expanded = process.argv.includes('--expanded');
  const passes = result.checks.filter((check) => check.status === 'pass');
  const nonPasses = result.checks.filter((check) => check.status !== 'pass');

  console.log(`=== ${title} ===\n`);

  (expanded ? result.checks : nonPasses).forEach((check) => {
    console.log(`  ${STATUS_ICON[check.status]} ${check.message}`);
  });

  if (!expanded && passes.length > 0) {
    console.log(`  ${STATUS_ICON['pass']} ${passes.length} check(s) passed`);
  }

  (result.tables ?? []).forEach((table) => printTable(table));

  console.log('\n=== Summary ===');
  console.log(result.summary);

  const failures = result.checks.filter((check) => check.status === 'fail');
  if (!options.strict || failures.length === 0) {
    if (options.strict) {
      console.log(`\n[${title}] PASSED.`);
    }
    return;
  }

  failures.forEach((check) => console.log(`::error::${check.message}`));
  console.error(`\n[${title}] FAILED: ${failures.length} problem(s) found.`);
  process.exit(1);
}
