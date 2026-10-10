import fs from 'fs-extra';
import { sortBy } from 'es-toolkit/compat';
import path from 'path';

const ROOT = 'src/app/helpers';

function barrelLines(dir: string): string[] {
  const lines = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
        ? true
        : entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          entry.name !== 'index.ts',
    )
    .map((entry) => `export * from './${entry.name.replace(/\.ts$/, '')}';`);

  return sortBy(lines);
}

function writeBarrels(dir: string): void {
  fs.writeFileSync(
    path.join(dir, 'index.ts'),
    barrelLines(dir).join('\n') + '\n',
  );

  fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => writeBarrels(path.join(dir, entry.name)));
}

writeBarrels(ROOT);
console.info(`Wrote helper barrels under ${ROOT}!`);
