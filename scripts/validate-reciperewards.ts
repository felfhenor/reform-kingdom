/**
 * Validates that every `recipeId` completion reward across every encounter
 * resolves to a real compiled recipe. `scripts/gamedata-build.ts` already
 * enforces this at build time (it halts with "has no corresponding id" for
 * any name that doesn't resolve) - this re-checks the *compiled* output
 * (`public/json/recipe.json`, `public/json/encounter.json`) as a defense in
 * depth against stale/hand-edited artifacts, mirroring
 * `validate-completionrewards.ts`.
 *
 * This must run after `npm run gamedata:build` has produced those files.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs-extra');
const path = require('path');

const RECIPE_FILE = path.resolve(__dirname, '../public/json/recipe.json');
const ENCOUNTER_FILE = path.resolve(
  __dirname,
  '../public/json/encounter.json',
);

function loadRequiredJson(filePath: string, description: string): any {
  if (!fs.existsSync(filePath)) {
    console.log(
      `::error::[validate:reciperewards] Could not find ${description} at "${filePath}". ` +
        `Run "npm run gamedata:build" before validating.`,
    );
    console.error(
      `[validate:reciperewards] FATAL: missing ${description} at "${filePath}".`,
    );
    process.exit(1);
  }

  return fs.readJsonSync(filePath);
}

function main(): void {
  console.log('=== validate:reciperewards ===');
  console.log(
    'Checking that every recipeId completion reward resolves to a real recipe.\n',
  );

  const recipes: Array<{ id: string; name: string }> = loadRequiredJson(
    RECIPE_FILE,
    'compiled recipe content (public/json/recipe.json)',
  );
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  console.log(`  Found ${recipes.length} recipe(s).`);

  const encounters: Array<{
    id: string;
    name: string;
    completionRewards?: any[];
  }> = loadRequiredJson(
    ENCOUNTER_FILE,
    'compiled encounter content (public/json/encounter.json)',
  );
  console.log(`  Found ${encounters.length} encounter(s).`);

  const problems: string[] = [];

  encounters.forEach((encounter) => {
    (encounter.completionRewards ?? []).forEach((reward: any) => {
      if (!reward.recipeId) return;

      if (!recipeIds.has(reward.recipeId)) {
        const message = `Encounter "${encounter.name}" has a completion reward referencing recipeId "${reward.recipeId}", which doesn't resolve to any compiled recipe.`;
        console.log(`  ✗ ${message}`);
        problems.push(message);
        return;
      }

      console.log(
        `  ✓ "${encounter.name}" -> recipeId "${reward.recipeId}" resolves.`,
      );
    });
  });

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(
        `::error file=${path.relative(path.resolve(__dirname, '..'), ENCOUNTER_FILE)}::${message}`,
      );
    });

    console.error(
      `\n[validate:reciperewards] FAILED: ${problems.length} recipe reward(s) don't resolve.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:reciperewards] PASSED: every recipeId completion reward resolves to a real recipe.',
  );
}

main();
