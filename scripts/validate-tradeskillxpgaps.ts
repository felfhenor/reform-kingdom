/**
 * Validates that, for every tradeskill, there is no level between 1 and the
 * highest `minTradeskillLevel` any of its recipes are authored at where
 * *no* recipe can grant XP - a "dead level" would strand a tradeskill
 * building there forever, since `craftQueueStart` in
 * `src/app/helpers/crafting.ts` only allows crafting a recipe once
 * `building.level >= recipe.minTradeskillLevel`, and a recipe stops
 * granting XP once the building has fully out-levelled it.
 *
 * `recipeGrantsXpAtLevel` below mirrors `craftXpChance` in that same file:
 * a recipe with `tradeskillXP <= 0` never grants XP; a recipe whose
 * `minTradeskillLevel === maxTradeskillLevel` is a single-level range that
 * is always guaranteed (see `craftXpChance`'s early-return comment) and so
 * covers every level from its `minTradeskillLevel` on with no upper bound;
 * anything else grants XP (at some chance > 0) for every level in
 * `[minTradeskillLevel, maxTradeskillLevel)` - the chance hits exactly 0%
 * once the building's level reaches `maxTradeskillLevel`.
 *
 * Runs against the raw `gamedata/recipe/**\/*.yml` sources rather than
 * compiled output, so it needs no build step first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPE_DIR = path.join(ROOT_DIR, 'gamedata', 'recipe');

const ALL_TRADESKILLS = [
  'Artificing',
  'Blacksmithing',
  'Jewelcrafting',
  'Tailoring',
  'Woodworking',
];

type Recipe = {
  name: string;
  tradeskill: string;
  minTradeskillLevel: number;
  maxTradeskillLevel: number;
  tradeskillXP: number;
};

async function loadRecipes(): Promise<Recipe[]> {
  const files: string[] = (await rec(RECIPE_DIR)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const recipes: Recipe[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as any[] | undefined;
    recipes.push(...(doc ?? []));
  });
  return recipes;
}

// See the file-level comment - mirrors `craftXpChance` in
// `src/app/helpers/crafting.ts`, collapsed to a boolean ("can this recipe
// grant any XP at all at this building level").
function recipeGrantsXpAtLevel(recipe: Recipe, level: number): boolean {
  if (recipe.tradeskillXP <= 0) return false;

  const { minTradeskillLevel: min, maxTradeskillLevel: max } = recipe;
  if (level < min) return false;
  if (max <= min) return true;

  return level < max;
}

function checkTradeskill(tradeskill: string, recipes: Recipe[]): string[] {
  const problems: string[] = [];

  const tradeskillRecipes = recipes.filter((r) => r.tradeskill === tradeskill);
  const xpRecipes = tradeskillRecipes.filter((r) => r.tradeskillXP > 0);

  if (xpRecipes.length === 0) {
    const message = `${tradeskill} has no recipe that grants tradeskill XP at all - it can never be levelled.`;
    console.log(`  ✗ ${message}`);
    problems.push(message);
    return problems;
  }

  xpRecipes.forEach((recipe) => {
    if (recipe.minTradeskillLevel > recipe.maxTradeskillLevel) {
      const message =
        `${tradeskill} recipe "${recipe.name}" has minTradeskillLevel ` +
        `(${recipe.minTradeskillLevel}) greater than maxTradeskillLevel ` +
        `(${recipe.maxTradeskillLevel}).`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
    }
  });

  const highestMinLevel = Math.max(
    ...xpRecipes.map((r) => r.minTradeskillLevel),
  );

  const gapLevels: number[] = [];
  for (let level = 1; level <= highestMinLevel; level += 1) {
    const covered = xpRecipes.some((recipe) =>
      recipeGrantsXpAtLevel(recipe, level),
    );
    if (!covered) gapLevels.push(level);
  }

  if (gapLevels.length > 0) {
    const message =
      `${tradeskill} has no XP-granting recipe covering level(s) ${gapLevels.join(', ')} ` +
      `(checked 1..${highestMinLevel}) - a building stuck at one of these levels can ` +
      `never gain enough XP to progress toward level ${highestMinLevel}.`;
    console.log(`  ✗ ${message}`);
    problems.push(message);
  } else {
    console.log(
      `  ✓ ${tradeskill}: levels 1..${highestMinLevel} are all covered by at least one XP-granting recipe (${xpRecipes.length} recipe(s) checked).`,
    );
  }

  return problems;
}

async function main(): Promise<void> {
  console.log('=== validate:tradeskillxpgaps ===');
  console.log(
    'Checking every tradeskill for a level with no recipe able to grant XP.\n',
  );

  const recipes = await loadRecipes();
  console.log(`Loaded ${recipes.length} recipe(s).\n`);

  const problems: string[] = [];
  ALL_TRADESKILLS.forEach((tradeskill) => {
    problems.push(...checkTradeskill(tradeskill, recipes));
  });

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(`::error::${message}`);
    });

    console.error(
      `\n[validate:tradeskillxpgaps] FAILED: ${problems.length} problem(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:tradeskillxpgaps] PASSED: every tradeskill has an unbroken XP path to its highest authored level.',
  );
}

main();
