/**
 * Validates that every recipe's `name` is prefixed according to what its
 * `result` produces:
 *   - "Weapon: "     - result is equipment whose type occupies the 'Weapon'
 *                      (main hand) slot
 *   - "Equipment: "  - result is equipment for any other slot
 *   - "Material: "   - result is an item
 *   - "Collectible: "- result is a collectible
 *
 * This must run after `npm run gamedata:build` has produced the compiled
 * `public/json/*.json` files.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs-extra');
const path = require('path');

const RECIPE_FILE = path.resolve(__dirname, '../public/json/recipe.json');
const EQUIPMENT_FILE = path.resolve(
  __dirname,
  '../public/json/equipment.json',
);
const ITEM_FILE = path.resolve(__dirname, '../public/json/item.json');
const COLLECTIBLE_FILE = path.resolve(
  __dirname,
  '../public/json/collectible.json',
);

// Mirrors `EquipmentTypeToSlot` in src/app/interfaces/equipment.ts - types
// that can occupy the 'Weapon' (main hand) slot.
const MAIN_HAND_EQUIPMENT_TYPES = new Set([
  'Bow',
  'Dagger',
  'Mace',
  'Spear',
  'Staff',
  'Sword',
  'Whip',
]);

const PREFIXES = {
  weapon: 'Weapon: ',
  equipment: 'Equipment: ',
  material: 'Material: ',
  collectible: 'Collectible: ',
};

function loadRequiredJson(filePath: string, description: string): any {
  if (!fs.existsSync(filePath)) {
    console.log(
      `::error::[validate:recipenames] Could not find ${description} at "${filePath}". ` +
        `Run "npm run gamedata:build" before validating.`,
    );
    console.error(
      `[validate:recipenames] FATAL: missing ${description} at "${filePath}".`,
    );
    process.exit(1);
  }

  return fs.readJsonSync(filePath);
}

function expectedPrefix(
  recipe: { name: string; result: any },
  equipmentTypeById: Map<string, string>,
  itemIds: Set<string>,
  collectibleIds: Set<string>,
): string | undefined {
  const { result } = recipe;

  if (result.equipmentId) {
    const type = equipmentTypeById.get(result.equipmentId);
    if (!type) return undefined;
    return MAIN_HAND_EQUIPMENT_TYPES.has(type)
      ? PREFIXES.weapon
      : PREFIXES.equipment;
  }

  if (result.itemId && itemIds.has(result.itemId)) return PREFIXES.material;

  if (result.collectibleId && collectibleIds.has(result.collectibleId)) {
    return PREFIXES.collectible;
  }

  return undefined;
}

function main(): void {
  console.log('=== validate:recipenames ===');
  console.log(
    'Checking that every recipe name is prefixed according to its result type (Weapon/Equipment/Material/Collectible).\n',
  );

  const recipes: Array<{ id: string; name: string; result: any }> =
    loadRequiredJson(
      RECIPE_FILE,
      'compiled recipe content (public/json/recipe.json)',
    );
  console.log(`  Found ${recipes.length} recipe(s).`);

  const equipment: Array<{ id: string; type: string }> = loadRequiredJson(
    EQUIPMENT_FILE,
    'compiled equipment content (public/json/equipment.json)',
  );
  const equipmentTypeById = new Map(
    equipment.map((item) => [item.id, item.type]),
  );

  const items: Array<{ id: string }> = loadRequiredJson(
    ITEM_FILE,
    'compiled item content (public/json/item.json)',
  );
  const itemIds = new Set(items.map((item) => item.id));

  const collectibles: Array<{ id: string }> = loadRequiredJson(
    COLLECTIBLE_FILE,
    'compiled collectible content (public/json/collectible.json)',
  );
  const collectibleIds = new Set(collectibles.map((item) => item.id));

  const problems: string[] = [];

  recipes.forEach((recipe) => {
    const prefix = expectedPrefix(
      recipe,
      equipmentTypeById,
      itemIds,
      collectibleIds,
    );

    if (!prefix) {
      const message = `Recipe "${recipe.name}" (${recipe.id}) has a result that doesn't resolve to a known equipment, item, or collectible.`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
      return;
    }

    if (!recipe.name.startsWith(prefix)) {
      const message = `Recipe "${recipe.name}" (${recipe.id}) should start with "${prefix}".`;
      console.log(`  ✗ ${message}`);
      problems.push(message);
      return;
    }

    console.log(`  ✓ "${recipe.name}" has the correct prefix.`);
  });

  console.log('\n=== Summary ===');

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((message) => {
      console.log(`  - ${message}`);
      console.log(
        `::error file=${path.relative(path.resolve(__dirname, '..'), RECIPE_FILE)}::${message}`,
      );
    });

    console.error(
      `\n[validate:recipenames] FAILED: ${problems.length} recipe name(s) don't match their result type.`,
    );
    process.exit(1);
  }

  console.log(
    '\n[validate:recipenames] PASSED: every recipe name matches its result type.',
  );
}

main();
