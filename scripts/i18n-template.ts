/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  i18nContentFields,
  i18nTiledObjectNames,
} from '@helpers/i18n/i18n-fields';
import { i18nFlatten } from '@helpers/i18n/i18n-parse';
import { merge, sortBy, uniq } from 'es-toolkit/compat';
import * as yaml from 'js-yaml';

const dump = (data: unknown) => yaml.dump(data, { lineWidth: -1 });

// Every line carries the English it was copied from: unchanged lines count as untranslated, and changed English gets flagged.
const templateEntry = (
  type: string,
  entry: any,
  existing: Record<string, unknown> = {},
): Record<string, unknown> => {
  const fields = i18nContentFields(entry, type);
  return {
    ...fields,
    ...existing,
    _en: { ...fields, ...((existing['_en'] as object) ?? {}) },
  };
};

const templateContent = (
  type: string,
  entries: any[],
  existing: Record<string, any> = {},
): Record<string, unknown> =>
  Object.fromEntries(
    sortBy(entries, (entry) => entry.name).map((entry) => [
      entry.name,
      templateEntry(type, entry, existing[entry.name]),
    ]),
  );

// Builds a language folder's files; any lines in `existing` are kept, so it also fills gaps in a partial translation.
export const i18nTemplateFiles = (
  englishUi: unknown,
  allContent: Record<string, any[]>,
  allMaps: Record<string, any>,
  existing: Record<string, any> = {},
): Record<string, string> => {
  const nodes = sortBy(
    uniq(Object.values(allMaps).flatMap(i18nTiledObjectNames)),
  );
  const files: Record<string, string> = {
    'ui.yml': dump(
      merge({}, englishUi, existing['ui.yml'], {
        _en: {
          ...i18nFlatten(englishUi, 'ui.yml', []),
          ...(existing['ui.yml']?._en ?? {}),
        },
      }),
    ),
    'nodes.yml': dump(
      Object.fromEntries(
        nodes.map((name) => [name, existing['nodes.yml']?.[name] ?? name]),
      ),
    ),
  };
  Object.entries(allContent).forEach(([type, entries]) => {
    const path = `content/${type}.yml`;
    files[path] = dump(templateContent(type, entries, existing[path]));
  });
  return files;
};
