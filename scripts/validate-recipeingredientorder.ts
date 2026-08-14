/**
 * Validates two ascending-order properties of crafting recipes:
 *
 * 1. Ingredient order: if a recipe requires an item that is itself the
 *    `result` of another recipe, that ingredient's recipe must have a
 *    `minTradeskillLevel` no higher than the recipe consuming it.
 *
 *    Example violation: a tradeskill-level-3 recipe requiring an item that
 *    can only be crafted at tradeskill level 6 - the level-3 recipe would
 *    be unreachable with real ingredients, since the level-6 ingredient
 *    recipe hasn't unlocked yet. This must hold for every item requirement,
 *    including ones produced by a *different* tradeskill (recipes commonly
 *    cross-consume materials from other trades).
 *
 * 2. Level-requirement order: within a given tradeskill and equipment type
 *    (e.g. Blacksmithing Daggers, Jewelcrafting Rings - the natural
 *    "upgrade line" a player crafts through), a recipe unlocked at a higher
 *    `minTradeskillLevel` must produce equipment whose `levelRequirement`
 *    is no lower than one unlocked at a lower `minTradeskillLevel`.
 *
 *    Example violation: a tradeskill-level-3 recipe producing a
 *    level-requirement-6 weapon, and a tradeskill-level-4 recipe (in the
 *    same type) producing a level-requirement-5 weapon - the later recipe
 *    would be a downgrade.
 *
 * Runs against the raw `gamedata/recipe/**\/*.yml` and
 * `gamedata/equipment/**\/*.yml` sources rather than compiled output, so it
 * needs no build step first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as yaml from 'js-yaml';
import rec from 'recursive-readdir';
import { sortBy } from 'es-toolkit/compat';

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPE_DIR = path.join(ROOT_DIR, 'gamedata', 'recipe');
const EQUIPMENT_DIR = path.join(ROOT_DIR, 'gamedata', 'equipment');

type RecipeRequirement = {
  itemId?: string;
  equipmentId?: string;
  collectibleId?: string;
  quantity?: number;
};

type Recipe = {
  id: string;
  name: string;
  tradeskill: string;
  minTradeskillLevel: number;
  result: { itemId?: string; equipmentId?: string; collectibleId?: string };
  requirements?: RecipeRequirement[];
};

type ItemProducer = {
  name: string;
  tradeskill: string;
  minTradeskillLevel: number;
};

type Equipment = {
  name: string;
  type: string;
  levelRequirement: number;
};

async function loadYamlDir<T>(dir: string): Promise<T[]> {
  const files: string[] = (await rec(dir)).filter((file: string) =>
    file.endsWith('.yml'),
  );

  const entries: T[] = [];
  files.forEach((file: string) => {
    const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as T[] | undefined;
    entries.push(...(doc ?? []));
  });
  return entries;
}

function buildItemProducerIndex(recipes: Recipe[]): Map<string, ItemProducer[]> {
  const index = new Map<string, ItemProducer[]>();

  recipes.forEach((recipe) => {
    const itemId = recipe.result?.itemId;
    if (!itemId) return;

    const producers = index.get(itemId) ?? [];
    producers.push({
      name: recipe.name,
      tradeskill: recipe.tradeskill,
      minTradeskillLevel: recipe.minTradeskillLevel,
    });
    index.set(itemId, producers);
  });

  return index;
}

function checkRecipe(
  recipe: Recipe,
  itemProducers: Map<string, ItemProducer[]>,
): string[] {
  const problems: string[] = [];

  (recipe.requirements ?? []).forEach((requirement) => {
    if (!requirement.itemId) return;

    const producers = itemProducers.get(requirement.itemId) ?? [];
    producers.forEach((producer) => {
      if (producer.minTradeskillLevel <= recipe.minTradeskillLevel) return;

      const message =
        `${recipe.tradeskill} recipe "${recipe.name}" (minTradeskillLevel ` +
        `${recipe.minTradeskillLevel}) requires item "${requirement.itemId}", ` +
        `but that item is only craftable via ${producer.tradeskill} recipe ` +
        `"${producer.name}" at minTradeskillLevel ${producer.minTradeskillLevel} - ` +
        `an ingredient recipe can't require a higher tradeskill level than the ` +
        `recipe that consumes it.`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
    });
  });

  return problems;
}

type EquipmentResultRecipe = {
  name: string;
  minTradeskillLevel: number;
  levelRequirement: number;
};

function checkLevelRequirementOrder(
  groupLabel: string,
  entries: EquipmentResultRecipe[],
): string[] {
  const problems: string[] = [];
  const sorted = sortBy(entries, [
    (entry: EquipmentResultRecipe) => entry.minTradeskillLevel,
  ]) as EquipmentResultRecipe[];

  let highestSoFar = sorted[0];
  sorted.slice(1).forEach((entry) => {
    if (entry.levelRequirement < highestSoFar.levelRequirement) {
      const message =
        `${groupLabel}: recipe "${entry.name}" (minTradeskillLevel ` +
        `${entry.minTradeskillLevel}) produces equipment with levelRequirement ` +
        `${entry.levelRequirement}, which is lower than recipe "${highestSoFar.name}" ` +
        `(minTradeskillLevel ${highestSoFar.minTradeskillLevel}, levelRequirement ` +
        `${highestSoFar.levelRequirement}) - a recipe unlocked at a higher tradeskill ` +
        `level shouldn't produce weaker gear than one unlocked earlier in the same line.`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
      return;
    }

    if (entry.levelRequirement > highestSoFar.levelRequirement) {
      highestSoFar = entry;
    }
  });

  return problems;
}

async function main(): Promise<void> {
  console.log('=== validate:recipeingredientorder ===');
  console.log(
    'Checking crafting recipe ordering: ingredient recipes must unlock at or before the recipes that consume them, and equipment level requirements must ascend with tradeskill level within each equipment type.\n',
  );

  const recipes = await loadYamlDir<Recipe>(RECIPE_DIR);
  console.log(`Loaded ${recipes.length} recipe(s).`);

  const equipment = await loadYamlDir<Equipment>(EQUIPMENT_DIR);
  console.log(`Loaded ${equipment.length} equipment piece(s).\n`);

  const equipmentByName = new Map(equipment.map((e) => [e.name, e]));

  const itemProducers = buildItemProducerIndex(recipes);

  const problems: string[] = [];
  recipes.forEach((recipe) => {
    problems.push(...checkRecipe(recipe, itemProducers));
  });

  const levelRequirementGroups = new Map<string, EquipmentResultRecipe[]>();
  recipes.forEach((recipe) => {
    const equipmentId = recipe.result?.equipmentId;
    if (!equipmentId) return;

    const equip = equipmentByName.get(equipmentId);
    if (!equip) return;

    const groupLabel = `${recipe.tradeskill} / ${equip.type}`;
    const group = levelRequirementGroups.get(groupLabel) ?? [];
    group.push({
      name: recipe.name,
      minTradeskillLevel: recipe.minTradeskillLevel,
      levelRequirement: equip.levelRequirement,
    });
    levelRequirementGroups.set(groupLabel, group);
  });

  levelRequirementGroups.forEach((entries, groupLabel) => {
    const groupProblems = checkLevelRequirementOrder(groupLabel, entries);
    if (groupProblems.length === 0) {
      console.log(
        `  ✓ ${groupLabel}: levelRequirement ascends with minTradeskillLevel across ${entries.length} recipe(s).`,
      );
    }
    problems.push(...groupProblems);
  });

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(`::error::${message}`);
    });

    console.error(
      `\n[validate:recipeingredientorder] FAILED: ${problems.length} problem(s) found.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:recipeingredientorder] PASSED: every recipe\'s item requirements are craftable at or below its own tradeskill level, and equipment level requirements ascend with tradeskill level within each type.',
  );
}

main();
