import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src/app/components', 'src/app/pages'];

const BANNED = [
  /\b(btn|badge|checkbox|range|text|bg|border|ring|outline|toggle|radio|progress|loading)-(secondary|accent)\b/,
  /\bbtn-(info|success|warning)\b/,
];

function templateFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(html|ts)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function offendingLines(path: string): string[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .flatMap((line, index) =>
      BANNED.some((pattern) => pattern.test(line))
        ? [`${relative('.', path)}:${index + 1}: ${line.trim()}`]
        : [],
    );
}

describe('palette guard', () => {
  it('uses no secondary/accent colors or feedback-colored buttons', () => {
    const offenders = ROOTS.flatMap(templateFiles).flatMap(offendingLines);

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
