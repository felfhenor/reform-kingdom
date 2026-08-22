/**
 * Fails if any raw sprite PNG under `gameassets/<type>/` is not referenced
 * by a `gamedata/<type>/*.yml` entry - i.e. art that was never wired up to
 * content, or was orphaned after a `sprite` value changed/an entry was
 * removed.
 *
 * "Used" is computed the same way `gamedata-art-spritesheets.ts` computes it
 * when it filters files into the packed atlas: an entry's own `sprite` index,
 * plus - for an animated entry (`frames > 0`, e.g. `job` portraits) - every
 * sequential index from `sprite` through `sprite + frames - 1`. Anything in
 * `gameassets/<type>/` outside that set is unused.
 *
 * `<type>` is discovered by reading the `gameassets/` folder itself, so a
 * newly added spritesheet type is picked up automatically - unless it's one
 * of `UNFILTERABLE_TYPES` (mirroring `gamedata-art-spritesheets.ts`'s
 * `unfilterableSpritesheets`), which the build copies wholesale with no
 * gamedata-driven usage check, or it has no matching `gamedata/<type>/`
 * folder at all; both are skipped rather than reported, since an empty
 * used-set would otherwise flag every file in the folder as unused.
 *
 * Runs against the raw `gamedata/` YAML sources and `gameassets/` art rather
 * than compiled output, so it needs no build step first.
 *
 * Usage: ts-node scripts/validate-unusedsprites
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');
const GAMEASSETS_DIR = path.join(ROOT_DIR, 'gameassets');

// Mirrors `unfilterableSpritesheets` in `gamedata-art-spritesheets.ts` -
// these types are copied into the packed atlas wholesale, with no
// gamedata-driven usage filtering, so "unused" isn't a meaningful concept
// for them.
const UNFILTERABLE_TYPES = ['hero', 'world-object', 'world-terrain'];

// Mirrors `generateSpriteArray` in `gamedata-art-spritesheets.ts` - expands
// an animated entry's starting sprite index into every frame it occupies.
function generateSpriteArray(start: string, frames: number): string[] {
  return Array(frames)
    .fill(undefined)
    .map((_, i) => (parseInt(start, 10) + i).toString().padStart(4, '0'));
}

async function loadContentEntries(type: string): Promise<any[]> {
  const dir = path.join(GAMEDATA_DIR, type);
  if (!fs.existsSync(dir)) return [];

  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const entries: any[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as any[] | undefined;
    entries.push(...(doc ?? []));
  });
  return entries;
}

function usedSpriteIndices(entries: any[]): Set<string> {
  const used = new Set<string>();
  entries.forEach((entry) => {
    if (entry.sprite === undefined || entry.sprite === null) return;
    const sprite = String(entry.sprite);
    if (entry.frames) {
      generateSpriteArray(sprite, entry.frames).forEach((s) => used.add(s));
    } else {
      used.add(sprite);
    }
  });
  return used;
}

type UnusedSprite = {
  type: string;
  file: string;
};

async function findUnusedForType(type: string): Promise<UnusedSprite[]> {
  const assetDir = path.join(GAMEASSETS_DIR, type);
  const files: string[] = (await rec(assetDir))
    .filter((file: string) => file.endsWith('.png'))
    .map((file: string) => path.basename(file, '.png'));

  const entries = await loadContentEntries(type);
  const used = usedSpriteIndices(entries);

  return files
    .filter((sprite) => !used.has(sprite))
    .sort()
    .map((sprite) => ({ type, file: `${sprite}.png` }));
}

async function validateType(type: string): Promise<UnusedSprite[]> {
  if (UNFILTERABLE_TYPES.includes(type)) {
    console.log(`  "${type}": unfilterable type, skipping.`);
    return [];
  }

  if (!fs.existsSync(path.join(GAMEDATA_DIR, type))) {
    console.log(
      `  "${type}": no matching "gamedata/${type}/" folder, skipping (can't tell what's used).`,
    );
    return [];
  }

  const unused = await findUnusedForType(type);

  if (unused.length === 0) {
    console.log(`  ✓ "${type}": no unused sprites.`);
  } else {
    unused.forEach((sprite) =>
      console.log(
        `  ✗ [${type}] "gameassets/${type}/${sprite.file}" is not referenced by any "gamedata/${type}/*.yml" entry.`,
      ),
    );
  }

  return unused;
}

async function main(): Promise<void> {
  console.log('=== validate:unusedsprites ===');
  console.log(
    'Checking that every sprite PNG under gameassets/ is referenced by a gamedata entry.\n',
  );

  const types = (await fs.readdir(GAMEASSETS_DIR)).filter((entry) =>
    fs.statSync(path.join(GAMEASSETS_DIR, entry)).isDirectory(),
  );

  const allUnused: UnusedSprite[] = [];
  for (const type of types) {
    allUnused.push(...(await validateType(type)));
  }

  console.log('\n=== Summary ===');

  if (allUnused.length > 0) {
    console.log(`\n${allUnused.length} unused sprite(s) found:\n`);
    allUnused.forEach((sprite) => {
      const message = `[${sprite.type}] "gameassets/${sprite.type}/${sprite.file}" is unused - remove it or wire it up to a gamedata entry.`;
      console.log(`  - ${message}`);
      console.log(`::error::${message}`);
    });

    console.error(
      `\n[validate:unusedsprites] FAILED: ${allUnused.length} unused sprite(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:unusedsprites] PASSED: every sprite in gameassets/ is referenced by content.',
  );
}

main();
