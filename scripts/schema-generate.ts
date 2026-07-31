/**
 * YAML Schema Generation from TypeScript Interfaces
 *
 * This script automatically generates JSON schemas for all game content types
 * using the `typescript-json-schema` library directly from the actual TypeScript
 * interfaces in the codebase. This ensures that schemas stay perfectly in sync
 * with TypeScript type definitions.
 *
 * HOW IT WORKS:
 * 1. Reads TypeScript interfaces directly from `src/app/interfaces/`
 * 2. typescript-json-schema generates JSON schemas from these interfaces
 * 3. Generated schemas provide IDE support and validation for YAML content
 *
 * KEEPING SCHEMAS IN SYNC WITH TYPESCRIPT:
 * - Schemas are automatically generated from actual TypeScript interfaces
 * - Run `npm run schemas:generate` to regenerate schemas after interface changes
 * - Schemas are automatically regenerated during `npm install` (postinstall)
 *
 * BENEFITS:
 * - Real-time validation in VSCode for YAML content files
 * - IntelliSense autocomplete for properties and enum values
 * - Type safety ensures content matches expected TypeScript interfaces
 * - Single source of truth: TypeScript interfaces drive both code and validation
 * - No manual maintenance required - schemas automatically stay in sync
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

const TJS = require('typescript-json-schema');
const fs = require('fs-extra');
const path = require('path');

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

// Top-level content properties (id, name, description, baseStats itself, etc.)
// are mandatory. But sub-object internals - the fields *inside* a nested
// object/array-item schema like `baseStats`, `damageScaling`, or a
// `techniques` entry - are meant to be authored as partials (see
// `ensure*`/`ensureStats` in content-initializers.ts), so their `required`
// arrays must be stripped. Only the outermost facet-level `required` arrays
// (which list which top-level properties are mandatory) are preserved.
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
    path.resolve(__dirname, '../src/app/interfaces/content-collectible.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-equipment.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-item.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-job.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-monster.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-skill.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-statuseffect.ts'),
    path.resolve(__dirname, '../src/app/interfaces/content-trait.ts'),
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
  collectible: 'CollectibleContent',
  equipment: 'EquipmentContent',
  item: 'ItemContent',
  job: 'JobContent',
  monster: 'MonsterContent',
  skill: 'EquipmentSkillContent',
  trait: 'TraitContent',
};

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
  } catch (error: any) {
    console.error(
      `Error generating schema for ${contentType}:`,
      error?.message || 'Unknown error',
    );
    console.error(error.stack);
  }
}

console.log('TypeScript-based schema generation complete!');
