/**
 * Validates every raw YAML content entry under `gamedata/<type>/**` against
 * its generated JSON schema in `schemas/<type>.schema.json` (see
 * `scripts/schema-generate.ts`). Those schemas are generated straight from
 * the TypeScript content interfaces, so every string-literal union (item
 * rarities, equipment types, tradeskills, skill/status-effect trigger and
 * behavior tags, etc.) is already spelled out as a JSON Schema `enum`/
 * `const` - this walks the raw content with Ajv and reports any value that
 * doesn't match one, which is almost always a typo (e.g. `type: Sowrd`
 * instead of `Sword`).
 *
 * This is deliberately narrower than "fully valid against the schema": the
 * `ensure*`/`initializeContent` helpers (`content-initializers.ts`) already
 * treat every content file as a `Partial<T>` and fill in sane defaults for
 * missing fields, so a merely *incomplete* entry is not an error here -
 * only a field that's present with a value outside its allowed set is. Ajv
 * errors are filtered down to `enum`/`const` keywords for exactly that
 * reason, and results are re-checked against the actual authored value so a
 * discriminated union's *other* branches (which always mismatch a `const`
 * tag by construction) don't get reported as false positives.
 *
 * Runs against the raw `gamedata/**\/*.yml` sources rather than compiled
 * output, so it needs no build step first - only `npm run schemas:generate`
 * (already wired into `postinstall`) to have produced `schemas/*.json`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';
import Ajv from 'ajv';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'schemas');

type LoadedEntry = {
  entry: any;
  file: string;
};

type MergedIssue = {
  instancePath: string;
  allowed: Set<string>;
};

async function loadContentType(folder: string): Promise<LoadedEntry[]> {
  const dir = path.join(GAMEDATA_DIR, folder);
  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const loaded: LoadedEntry[] = [];

  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as any[] | undefined;
    const relativeFile = path.relative(ROOT_DIR, file);

    (doc ?? []).forEach((entry) => {
      loaded.push({ entry, file: relativeFile });
    });
  });

  return loaded;
}

// JSON Pointer resolution (RFC 6901) against the concatenated entries array,
// so a merged issue's `instancePath` can be traced back to the actual
// authored value that triggered it.
function resolvePointer(root: any, pointer: string): unknown {
  if (pointer === '') return root;

  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = root;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = Array.isArray(current) ? current[Number(part)] : current[part];
  }
  return current;
}

// Converts a JSON Pointer into a readable `foo.bar[2].baz` path, dropping
// the leading array index (the entry's position in the concatenated array,
// not part of the field path itself).
function prettyFieldPath(pointer: string): string {
  const parts = pointer.split('/').filter(Boolean).slice(1);
  if (parts.length === 0) return '(root)';

  return parts.reduce((acc, part) => {
    if (/^\d+$/.test(part)) return `${acc}[${part}]`;
    return acc ? `${acc}.${part}` : part;
  }, '');
}

// Ajv re-checks every branch of an `anyOf` (e.g. `DroppedReward`,
// `StatusEffectBehavior`), so a single genuine typo on a discriminated
// union's tag produces one `const` error per *other* branch (each of which
// always mismatches by construction) all pointing at the same
// `instancePath`. Grouping by path and taking the union of allowed values
// collapses that back into a single message; comparing against the actual
// authored value (rather than trusting the error count) is what avoids
// flagging a tag that's actually correct but merely shares a path with a
// sibling field that mismatched in the branch that *did* apply.
function mergeEnumIssues(errors: any[]): Map<string, MergedIssue> {
  const merged = new Map<string, MergedIssue>();

  errors.forEach((error: any) => {
    if (error.keyword !== 'enum' && error.keyword !== 'const') return;

    const issue = merged.get(error.instancePath) ?? {
      instancePath: error.instancePath,
      allowed: new Set<string>(),
    };

    if (error.keyword === 'enum') {
      (error.params.allowedValues as unknown[]).forEach((value) =>
        issue.allowed.add(String(value)),
      );
    } else {
      issue.allowed.add(String(error.params.allowedValue));
    }

    merged.set(error.instancePath, issue);
  });

  return merged;
}

function entryLabel(loaded: LoadedEntry[], instancePath: string): string {
  const match = /^\/(\d+)/.exec(instancePath);
  const index = match ? Number(match[1]) : -1;
  const source = loaded[index];
  if (!source) return `entry #${index} (unknown source)`;

  const name = source.entry?.name ?? source.entry?.id ?? `entry #${index}`;
  return `"${name}" (${source.file})`;
}

async function validateContentType(
  ajv: InstanceType<typeof Ajv>,
  folder: string,
): Promise<string[]> {
  const schemaPath = path.join(SCHEMAS_DIR, `${folder}.schema.json`);
  if (!fs.existsSync(schemaPath)) {
    console.log(
      `  (skipping "${folder}" - no schema at ${path.relative(ROOT_DIR, schemaPath)}, run "npm run schemas:generate")`,
    );
    return [];
  }

  const loaded = await loadContentType(folder);
  if (loaded.length === 0) {
    console.log(`  "${folder}": no entries found, skipping.`);
    return [];
  }

  const schema = fs.readJsonSync(schemaPath);
  const validate = ajv.compile(schema);
  const entries = loaded.map((l) => l.entry);

  const valid = validate(entries);
  if (valid) {
    console.log(`  ✓ "${folder}": ${loaded.length} entrie(s) valid.`);
    return [];
  }

  const merged = mergeEnumIssues(validate.errors ?? []);
  const problems: string[] = [];

  merged.forEach((issue) => {
    const actual = resolvePointer(entries, issue.instancePath);
    if (actual === undefined || issue.allowed.has(String(actual))) return;

    const message =
      `[${folder}] ${entryLabel(loaded, issue.instancePath)}: ` +
      `field "${prettyFieldPath(issue.instancePath)}" has invalid value ` +
      `${JSON.stringify(actual)} - expected one of: ${[...issue.allowed].sort().join(', ')}`;

    console.log(`  ✗ ${message}`);
    problems.push(message);
  });

  if (problems.length === 0) {
    console.log(
      `  ✓ "${folder}": ${loaded.length} entrie(s) valid (no enum/const mismatches).`,
    );
  }

  return problems;
}

async function main(): Promise<void> {
  console.log('=== validate:schemas ===');
  console.log(
    'Checking every gamedata YAML entry against its generated JSON schema for invalid enum/const values (typos).\n',
  );

  const ajv = new Ajv({ allErrors: true, strict: false });

  const folders: string[] = fs
    .readdirSync(GAMEDATA_DIR)
    .filter((name: string) =>
      fs.statSync(path.join(GAMEDATA_DIR, name)).isDirectory(),
    )
    .sort();

  const problems: string[] = [];

  for (const folder of folders) {
    const folderProblems = await validateContentType(ajv, folder);
    problems.push(...folderProblems);
  }

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(`::error::${message}`);
    });

    console.error(
      `\n[validate:schemas] FAILED: ${problems.length} invalid enum/const value(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:schemas] PASSED: every gamedata entry has valid enum/const values.',
  );
}

main();
