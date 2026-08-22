/**
 * Reports on the debuff-resistance tag system introduced alongside
 * `StatusEffectTag`: which status effects belong to each tag family, which
 * equipment/items grant resistance to each tag and how much, and whether any
 * tag has a stretch of levels with no gear granting resistance to it.
 *
 * Three independent sections:
 *
 * 1. Tag families - for every `StatusEffectTag`, lists every status effect
 *    that carries it (a debuff can carry more than one tag, so it can show
 *    up under more than one family).
 *
 * 2. Resistance sources - for every tag, lists every equipment entry
 *    granting `debuffResistances` for it (sorted by level) and every item
 *    granting `infusionDebuffResistances` for it.
 *
 * 3. Level-window coverage - reuses the fixed-size level-window bucketing
 *    from `analyze-contentgaps.ts` (same `--gap` default of 4) against
 *    equipment `levelRequirement`, flagging any window with no equipment
 *    granting resistance to a given tag. Items are excluded from this check
 *    since they carry no level of their own.
 *
 * Runs against raw `gamedata/**\/*.yml` sources, so it needs no build step
 * first. This is an analysis tool, not a CI gate - it always exits 0.
 *
 * Usage: ts-node scripts/analyze-debuffresistance [--gap=4]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMEDATA_DIR = path.join(ROOT_DIR, 'gamedata');

// Keep in sync with `StatusEffectTag` in `src/app/interfaces/content-statuseffect.ts`.
const ALL_STATUS_EFFECT_TAGS = [
  'Stun',
  'StatDown',
  'Accuracy',
  'DamageOverTime',
  'Poison',
  'Burn',
];

async function loadContentType(folder: string): Promise<any[]> {
  const dir = path.join(GAMEDATA_DIR, folder);
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

function gapWindows(
  levels: number[],
  maxLevel: number,
  gapSize: number,
): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (let start = 1; start <= maxLevel; start += gapSize) {
    const end = Math.min(start + gapSize - 1, maxLevel);
    const covered = levels.some((level) => level >= start && level <= end);
    if (!covered) windows.push({ start, end });
  }
  return windows;
}

function formatWindows(windows: { start: number; end: number }[]): string {
  return windows
    .map((w) => (w.start === w.end ? `${w.start}` : `${w.start}-${w.end}`))
    .join(', ');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const gapArg = args.find((arg) => arg.startsWith('--gap='));
  const gapSize = gapArg ? Number(gapArg.split('=')[1]) : 4;

  if (!Number.isInteger(gapSize) || gapSize < 1) {
    console.error('Usage: ts-node scripts/analyze-debuffresistance [--gap=4]');
    process.exit(1);
  }

  console.log('=== analyze:debuffresistance ===\n');

  const [statusEffects, equipment, items] = await Promise.all([
    loadContentType('statuseffect'),
    loadContentType('equipment'),
    loadContentType('item'),
  ]);

  console.log(
    `Loaded ${statusEffects.length} status effect(s), ${equipment.length} equipment(s), ${items.length} item(s).\n`,
  );

  const obtainableEquipment = equipment.filter((e) => !e.unobtainable);
  const maxContentLevel = Math.max(
    0,
    ...obtainableEquipment.map((e) => e.levelRequirement ?? 0),
  );

  // === Part 1: tag families ===
  console.log('=== Tag families ===\n');

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const members = statusEffects.filter((effect) =>
      (effect.tags ?? []).includes(tag),
    );

    if (members.length === 0) {
      console.log(`  ${tag}: no status effects carry this tag.`);
      return;
    }

    console.log(`  ${tag}: ${members.map((e) => e.name).join(', ')}`);
  });

  // === Part 2: resistance sources ===
  console.log('\n=== Resistance sources ===\n');

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const equipmentSources = obtainableEquipment
      .filter((e) => (e.debuffResistances?.[tag] ?? 0) !== 0)
      .sort((a, b) => (a.levelRequirement ?? 0) - (b.levelRequirement ?? 0));

    const itemSources = items.filter(
      (i) => (i.infusionDebuffResistances?.[tag] ?? 0) !== 0,
    );

    if (equipmentSources.length === 0 && itemSources.length === 0) {
      console.log(`  ${tag}: no equipment or items grant this resistance.`);
      return;
    }

    console.log(`  ${tag}:`);
    equipmentSources.forEach((e) =>
      console.log(
        `      - Lv${e.levelRequirement} ${e.name} (equipment): +${e.debuffResistances[tag]}%`,
      ),
    );
    itemSources.forEach((i) =>
      console.log(
        `      - ${i.name} (infusion item): +${i.infusionDebuffResistances[tag]}%`,
      ),
    );
  });

  // === Part 3: level-window coverage ===
  console.log('\n=== Level-window coverage (equipment only) ===\n');
  console.log(
    `Top content level: ${maxContentLevel}. Gap window size: ${gapSize} level(s).\n`,
  );

  const problems: string[] = [];

  ALL_STATUS_EFFECT_TAGS.forEach((tag) => {
    const levels = obtainableEquipment
      .filter((e) => (e.debuffResistances?.[tag] ?? 0) !== 0)
      .map((e) => e.levelRequirement);

    if (levels.length === 0) {
      const message = `Tag "${tag}" has no equipment granting resistance to it at any level.`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
      return;
    }

    const windows = gapWindows(levels, maxContentLevel, gapSize);
    if (windows.length > 0) {
      const message = `Tag "${tag}" has no resistance-granting equipment at level window(s): ${formatWindows(windows)} (checked 1..${maxContentLevel}, ${levels.length} item(s) total).`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
    } else {
      console.log(
        `  ✓ ${tag}: levels 1..${maxContentLevel} all have at least one resistance-granting item (${levels.length} item(s) total).`,
      );
    }
  });

  console.log('\n=== Summary ===');
  console.log(
    problems.length === 0
      ? '\n[analyze:debuffresistance] No coverage gaps found.'
      : `\n[analyze:debuffresistance] ${problems.length} coverage gap(s) found.`,
  );
}

main();
