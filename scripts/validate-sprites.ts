/**
 * Validates that every content entry with a `sprite` field (equipment, item,
 * job, monster, skill, collectible, globaleffect - i.e. every `AtlasedImage`
 * type in `src/app/interfaces/artable.ts`) uses a sprite index that's unique
 * *within its own content type*.
 *
 * Each content type's `sprite` value (e.g. `'0012'`) is an index into that
 * type's own flat spritesheet atlas under `gameassets/<type>/<sprite>.png` -
 * atlases are per-type, so uniqueness is only meaningful scoped to a single
 * type (an equipment entry and a monster entry can safely share `'0000'`,
 * since they're drawn from different atlases). Two entries of the *same*
 * type sharing a sprite index means one of them renders as the other in the
 * UI, which is almost always a mistake - the one intentional exception is
 * tiered variants of the same base entry (e.g. skill "Fireball I"/
 * "Fireball II"), which reuse one icon across their tiers on purpose. Those
 * are detected by stripping a trailing roman-numeral tier suffix from
 * `name` and treating entries with the same base name as one family; a
 * shared sprite is only flagged when it crosses family lines.
 *
 * Runs against the raw gamedata/ YAML sources rather than compiled output,
 * so it needs no build step first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');

// Matches the `AtlasedImage` union in `src/app/interfaces/artable.ts` -
// these are the only content types that carry a `sprite` field.
const SPRITED_CONTENT_TYPES = [
  'collectible',
  'equipment',
  'globaleffect',
  'item',
  'job',
  'monster',
  'skill',
];

// Strips a trailing roman-numeral tier suffix ("Fireball II" -> "Fireball")
// so tiered variants of the same entry can be recognized as one family.
const TIER_SUFFIX = /\s+(I{1,3}|IV|VI{0,3}|IX|X)$/;

function baseName(name: string): string {
  return name.replace(TIER_SUFFIX, '');
}

type LoadedEntry = {
  entry: any;
  file: string;
};

async function loadContentType(folder: string): Promise<LoadedEntry[]> {
  const dir = path.join(GAMEDATA_DIR, folder);
  if (!fs.existsSync(dir)) return [];

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

function entryLabel(loaded: LoadedEntry): string {
  const name = loaded.entry?.name ?? loaded.entry?.id ?? '(unnamed)';
  return `"${name}" (${loaded.file})`;
}

async function validateContentType(folder: string): Promise<string[]> {
  const loaded = await loadContentType(folder);
  if (loaded.length === 0) {
    console.log(`  "${folder}": no entries found, skipping.`);
    return [];
  }

  const owners = new Map<string, LoadedEntry>();
  const problems: string[] = [];

  loaded.forEach((current) => {
    const sprite = current.entry?.sprite;
    if (sprite === undefined || sprite === null) {
      console.log(
        `  ✗ [${folder}] ${entryLabel(current)}: missing a "sprite" field.`,
      );
      problems.push(
        `[${folder}] ${entryLabel(current)} is missing a "sprite" field.`,
      );
      return;
    }

    const owner = owners.get(sprite);
    if (owner) {
      const currentFamily = baseName(current.entry?.name ?? '');
      const ownerFamily = baseName(owner.entry?.name ?? '');

      if (currentFamily && currentFamily === ownerFamily) {
        // Same base entry, different tier (e.g. "Fireball I"/"Fireball
        // II") - intentionally shares an icon, not a collision.
        return;
      }

      const message =
        `[${folder}] ${entryLabel(current)} uses sprite "${sprite}", ` +
        `which is already used by ${entryLabel(owner)}. Sprite indices must ` +
        `be unique within "${folder}" (except across tiers of the same ` +
        `entry) - pick an unused index.`;

      console.log(`  ✗ ${message}`);
      problems.push(message);
      return;
    }

    owners.set(sprite, current);
  });

  if (problems.length === 0) {
    console.log(
      `  ✓ "${folder}": ${loaded.length} entrie(s), ${owners.size} unique sprite(s).`,
    );
  }

  return problems;
}

async function main(): Promise<void> {
  console.log('=== validate:sprites ===');
  console.log(
    'Checking that every gamedata entry uses a sprite index that is unique within its own content type.\n',
  );

  const problems: string[] = [];

  for (const folder of SPRITED_CONTENT_TYPES) {
    console.log(`Checking "${folder}"...`);
    const folderProblems = await validateContentType(folder);
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
      `\n[validate:sprites] FAILED: ${problems.length} sprite problem(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:sprites] PASSED: every content type uses unique sprite indices.',
  );
}

main();
