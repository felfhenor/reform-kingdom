// Generates JSON schemas for YAML content validation directly from the
// TypeScript content interfaces via typescript-json-schema. Run via `npm run
// schemas:generate` after interface changes (also runs on postinstall).

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs-extra';
import path from 'path';
import * as TJS from 'typescript-json-schema';

// Ensure the schemas directory exists
const schemasDir = './schemas';
fs.ensureDirSync(schemasDir);

console.log('Generating JSON schemas from TypeScript interfaces...');

// Post-process schema to fix issues with branded types, StatBlocks, and optional properties
function fixSchema(schema: any): any {
  if (!schema) return schema;

  // Recursively process the schema
  function processSchema(obj: any, parentKey?: string): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item: any) => processSchema(item));
    }

    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      let processedValue = processSchema(value as any, key);

      // Fix branded type IDs - convert complex allOf structures to simple strings for ID fields
      if (key === 'id' || key.includes('Id') || key.endsWith('id')) {
        if (processedValue && typeof processedValue === 'object') {
          if (processedValue.allOf || processedValue.type === 'object') {
            // Convert branded types to simple string type
            processedValue = {
              type: 'string',
              title: key,
            };
          }
        }
      }

      // Fix all ID-related arrays to be arrays of strings (run after processing)
      if (
        key.includes('Id') &&
        key.endsWith('s') &&
        processedValue &&
        processedValue.type === 'array'
      ) {
        processedValue = {
          type: 'array',
          items: { type: 'string' },
          title: key,
          description: `Array of ${key.replace('s', '')} IDs`,
        };
      }

      processed[key] = processedValue;
    }

    return processed;
  }

  return processSchema(schema);
}

// `__type` is injected by the content loader at runtime (`ContentService`) and
// is never present in the authored YAML, so it must not be required/allowed
// in the schema used to validate those YAML files.
function stripInjectedFields(schema: any): any {
  if (!schema) return schema;

  function traverse(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
      return obj.map(traverse).filter((item) => {
        if (item && typeof item === 'object' && item.type === 'object') {
          const hasProps =
            item.properties && Object.keys(item.properties).length > 0;
          return hasProps;
        }
        return true;
      });
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'properties' && value && typeof value === 'object') {
        const props = { ...(value as any) };
        delete props.__type;
        result[key] = traverse(props);
        continue;
      }

      if (key === 'required' && Array.isArray(value)) {
        const filtered = value.filter((prop) => prop !== '__type');
        if (filtered.length > 0) result[key] = filtered;
        continue;
      }

      result[key] = traverse(value);
    }

    return result;
  }

  return traverse(schema);
}

// Nested object/array-item fields (baseStats, techniques, etc.) are authored
// as partials (see `ensure*` in content-initializers.ts), so only the
// top-level facet's own `required` array is preserved - deeper ones are stripped.
function relaxSubObjectRequired(schema: any): any {
  if (!schema) return schema;

  // Strips every `required` found within a schema node and its descendants,
  // without exception - used once we've descended past the top-level facet.
  function stripAllRequired(node: any): any {
    if (typeof node !== 'object' || node === null) return node;

    if (Array.isArray(node)) {
      return node.map(stripAllRequired);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'required') continue;
      result[key] = stripAllRequired(value);
    }

    return result;
  }

  // Walks the top-level facets (the `allOf` entries of the content item),
  // keeping their own `required` array intact but relaxing everything found
  // one level deeper - i.e. inside each property's own schema.
  function relaxFacet(facet: any): any {
    if (typeof facet !== 'object' || facet === null) return facet;

    if (Array.isArray(facet)) {
      return facet.map(relaxFacet);
    }

    const result: any = { ...facet };

    if (result.properties) {
      const newProps: Record<string, any> = {};
      for (const [key, propSchema] of Object.entries(result.properties)) {
        newProps[key] = stripAllRequired(propSchema);
      }
      result.properties = newProps;
    }

    return result;
  }

  const result = { ...schema };
  if (result.items && Array.isArray(result.items.allOf)) {
    result.items = {
      ...result.items,
      allOf: result.items.allOf.map(relaxFacet),
    };
  } else if (result.items) {
    result.items = relaxFacet(result.items);
  }

  return result;
}

// Additional post-processing function to fix complex nested ID arrays
function postProcessIdArrays(schema: any): any {
  if (!schema) return schema;

  function traverse(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
      return obj.map(traverse);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      let processedValue = traverse(value);

      // Fix any array with complex allOf items that should be simple strings
      if (
        key.includes('Id') &&
        key.endsWith('s') &&
        processedValue &&
        processedValue.type === 'array' &&
        processedValue.items &&
        processedValue.items.allOf
      ) {
        // Check if it's a branded type pattern (empty object + string)
        const hasString = processedValue.items.allOf.some(
          (item: any) => item.type === 'string',
        );
        const hasEmptyObject = processedValue.items.allOf.some(
          (item: any) =>
            item.type === 'object' &&
            (!item.properties || Object.keys(item.properties).length === 0),
        );

        if (hasString && hasEmptyObject) {
          processedValue = {
            type: 'array',
            items: { type: 'string' },
            title: key,
            description: `Array of ${key.replace('s', '')} IDs`,
          };
        }
      }

      result[key] = processedValue;
    }

    return result;
  }

  return traverse(schema);
}

// Settings for typescript-json-schema
const settings = {
  required: true,
  strictNullChecks: false, // Disabled to handle complex types
  esModuleInterop: true,
  skipLibCheck: true,
  noImplicitAny: false, // Disabled to handle complex types
  additionalProperties: false,
  titles: true,
  descriptions: true,
  ref: false,
  aliasRef: false,
  topRef: false,
  defaultProps: false,
  ignoreErrors: true, // Ignore TypeScript errors during schema generation
  excludePrivate: true,
  rejectDateType: false,
};

// Create a program from the actual interface files
const program = TJS.getProgramFromFiles(
  [
    path.resolve(__dirname, '../src/app/interfaces/content-astralprojector.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-caravan.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-caravan-trader.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-collectible.ts'),
    path.resolve(
      __dirname,
      '../src/app/interfaces/content-commission-offer.ts',
    ),
    path.resolve(__dirname, '../src/app/interfaces/content-encounter.ts'),
    path.resolve(
      __dirname,
      '../src/app/interfaces/content-encounter-random.ts',
    ),
    path.resolve(__dirname, '../src/app/interfaces/content-equipment.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-gathering.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-globaleffect.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-item.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-job.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-monster.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-node-override.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-recipe.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-skill.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-statuseffect.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-trait.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-tradeskill.ts'),
    path.resolve(
      __dirname,
      '../src/app/interfaces/content-tradeskill-level-requirement.ts',
    ),
    path.resolve(__dirname, '../src/app/interfaces/content-worker.ts'),
  ],
  {
    strictNullChecks: false, // Disabled to handle complex types
    esModuleInterop: true,
    skipLibCheck: true,
    noImplicitAny: false, // Disabled to handle complex types
    resolveJsonModule: true,
    moduleResolution: 1, // NodeJs
    target: 99, // ESNext
    allowSyntheticDefaultImports: true,
    baseUrl: path.resolve(__dirname, '../'),
    paths: {
      '@interfaces/*': ['src/app/interfaces/*'],
      '@interfaces': ['src/app/interfaces/index.ts'],
      '@helpers/*': ['src/app/helpers/*'],
      '@helpers': ['src/app/helpers/index.ts'],
    },
  },
);

// Content type mappings to actual TypeScript interface names.
// Keys must match the gamedata folder names (and `ContentType` union).
const contentTypeMap = {
  astralprojector: 'AstralProjectorContent',
  caravan: 'CaravanContent',
  caravantrader: 'CaravanTraderContent',
  collectible: 'CollectibleContent',
  commissionoffer: 'CommissionOfferContent',
  encounter: 'EncounterContent',
  encounterrandom: 'EncounterRandomContent',
  equipment: 'EquipmentContent',
  gathering: 'GatheringContent',
  globaleffect: 'GlobalEffectContent',
  item: 'ItemContent',
  job: 'JobContent',
  monster: 'MonsterContent',
  nodeoverride: 'NodeOverrideContent',
  recipe: 'RecipeContent',
  skill: 'EquipmentSkillContent',
  statuseffect: 'StatusEffectContent',
  tradeskill: 'TradeskillContent',
  tradeskilllevelrequirement: 'TradeskillLevelRequirementContent',
  worker: 'WorkerContent',
};

// Content types whose schema generated successfully - used to populate
// `.vscode/settings.json` -> `yaml.schemas` below.
const generatedContentTypes: string[] = [];

// Generate schemas for each content type
for (const [contentType, typeName] of Object.entries(contentTypeMap)) {
  try {
    console.log(
      `Generating schema for ${contentType} from TypeScript type ${typeName}...`,
    );

    let schema = TJS.generateSchema(program, typeName, settings);

    if (!schema) {
      console.warn(
        `Could not generate schema for ${contentType} (${typeName})`,
      );
      continue;
    }

    // Fix schema issues
    schema = stripInjectedFields(postProcessIdArrays(fixSchema(schema)));

    // For single content items, wrap in array for YAML content files
    let arraySchema: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} content schema`,
      description: `JSON schema for ${contentType} YAML content files, automatically generated from TypeScript interfaces`,
      type: 'array',
      items: schema,
    };

    arraySchema = relaxSubObjectRequired(arraySchema);

    const schemaPath = path.join(schemasDir, `${contentType}.schema.json`);
    fs.writeJsonSync(schemaPath, arraySchema, { spaces: 2 });
    console.log(`✓ Generated schema: ${schemaPath}`);

    generatedContentTypes.push(contentType);
  } catch (error: any) {
    console.error(
      `Error generating schema for ${contentType}:`,
      error?.message || 'Unknown error',
    );
    console.error(error.stack);
  }
}

// Patches the `"yaml.schemas"` block via string surgery rather than a full
// JSON round-trip, which would reformat unrelated keys and add diff noise.
function updateVscodeSettings(): void {
  const settingsPath = path.resolve(__dirname, '../.vscode/settings.json');

  if (!fs.existsSync(settingsPath)) {
    console.warn(`Could not find ${settingsPath}, skipping settings update.`);
    return;
  }

  const raw: string = fs.readFileSync(settingsPath, 'utf-8');

  // Recursive glob - gamedata-build.ts scans content folders recursively too.
  const schemaEntries = generatedContentTypes
    .map(
      (contentType) =>
        `    "./schemas/${contentType}.schema.json": "gamedata/${contentType}/**/*.yml"`,
    )
    .join(',\n');
  const newBlock = `"yaml.schemas": {\n${schemaEntries}\n  }`;

  const blockPattern = /"yaml\.schemas":\s*\{[^{}]*\}/;
  const updated = blockPattern.test(raw)
    ? raw.replace(blockPattern, newBlock)
    : raw.replace(/}\s*$/, (match) => `,\n  ${newBlock}\n${match.trim()}`);

  fs.writeFileSync(settingsPath, updated);
  console.log(`✓ Updated yaml.schemas in ${settingsPath}`);
}

updateVscodeSettings();

console.log('TypeScript-based schema generation complete!');
