import {
  i18nHasForbiddenText,
  i18nIsNameField,
  i18nIsPluralForms,
  i18nIsValidTemplate,
} from '@helpers/i18n/i18n-text';
import type {
  I18nContentFields,
  I18nContentTranslations,
  I18nFlatStrings,
  I18nLanguageInfo,
  I18nParseResult,
} from '@interfaces';

const SOURCE_KEY = '_en';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function i18nCanonicalLocale(locale: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
}

export function i18nLanguageInfoParse(
  raw: unknown,
  errors: string[],
): I18nLanguageInfo | undefined {
  const data = asRecord(raw) ?? {};
  const locale = i18nCanonicalLocale(String(data['locale'] ?? ''));
  if (!locale) {
    errors.push('language.yml needs a valid `locale`, e.g. "fr" or "pt-BR".');
    return undefined;
  }

  if (!data['languageName']) {
    errors.push('language.yml needs a `languageName`, e.g. "Français".');
    return undefined;
  }

  return { locale, languageName: String(data['languageName']) };
}

function i18nTextCheck(
  where: string,
  text: string,
  errors: string[],
  isName = false,
): boolean {
  if (!i18nIsValidTemplate(text)) {
    errors.push(`${where}: has a broken {{ }} placeholder.`);
    return false;
  }
  if (!i18nHasForbiddenText(text, isName)) return true;
  errors.push(
    isName
      ? `${where}: names cannot contain <, >, ** or @@.`
      : `${where}: text cannot contain <, > or @@, and ** must come in pairs.`,
  );
  return false;
}

// Lines still equal to the English they were copied from aren't translated yet, so later English edits must show through.
function i18nDropUntranslated(
  lines: I18nFlatStrings,
  sources: I18nFlatStrings,
): I18nFlatStrings {
  return Object.fromEntries(
    Object.entries(lines).filter(([key, text]) => sources[key] !== text),
  );
}

function i18nSourcesParse(raw: unknown): I18nFlatStrings {
  return Object.fromEntries(
    Object.entries(asRecord(raw) ?? {}).map(([key, text]) => [
      key,
      String(text),
    ]),
  );
}

export function i18nFlatten(
  raw: unknown,
  file: string,
  errors: string[],
  prefix = '',
  out: I18nFlatStrings = {},
): I18nFlatStrings {
  Object.entries(asRecord(raw) ?? {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      if (i18nTextCheck(`${file} ${path}`, value, errors)) out[path] = value;
      return;
    }
    if (asRecord(value)) {
      i18nFlatten(value, file, errors, path, out);
      return;
    }
    errors.push(`${file} ${path}: expected text or a group of keys.`);
  });
  return out;
}

export function i18nPluralKeys(raw: unknown, prefix = ''): string[] {
  return Object.entries(asRecord(raw) ?? {}).flatMap(([key, value]) => {
    const record = asRecord(value);
    if (!record) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return i18nIsPluralForms(record) ? [path] : i18nPluralKeys(record, path);
  });
}

function i18nEntryParse(
  where: string,
  raw: unknown,
  errors: string[],
): { fields: I18nContentFields; sources: I18nContentFields } {
  const fields: I18nContentFields = {};
  const sources: I18nContentFields = {};
  Object.entries(asRecord(raw) ?? {}).forEach(([path, value]) => {
    if (path === SOURCE_KEY) {
      Object.assign(sources, i18nSourcesParse(value));
      return;
    }
    if (typeof value !== 'string') {
      errors.push(`${where} ${path}: expected text.`);
      return;
    }
    const isName = i18nIsNameField(path);
    if (i18nTextCheck(`${where} ${path}`, value, errors, isName)) {
      fields[path] = value;
    }
  });
  return { fields: i18nDropUntranslated(fields, sources), sources };
}

function i18nContentParse(
  docs: Record<string, unknown>,
  contentTypes: string[],
  errors: string[],
): { content: I18nContentTranslations; sources: I18nContentTranslations } {
  const content: I18nContentTranslations = {};
  const sources: I18nContentTranslations = {};
  Object.entries(docs).forEach(([file, raw]) => {
    const type = /^content\/([^/]+)\.ya?ml$/.exec(file)?.[1];
    if (!type) return;
    if (!contentTypes.includes(type)) {
      errors.push(`${file}: "${type}" is not a content type.`);
      return;
    }

    Object.entries(asRecord(raw) ?? {}).forEach(([name, entry]) => {
      const parsed = i18nEntryParse(`${file} "${name}"`, entry, errors);
      (content[type] ??= {})[name] = parsed.fields;
      if (Object.keys(parsed.sources).length > 0) {
        (sources[type] ??= {})[name] = parsed.sources;
      }
    });
  });
  return { content, sources };
}

function i18nNodesParse(raw: unknown, errors: string[]): I18nFlatStrings {
  const nodes: I18nFlatStrings = {};
  Object.entries(asRecord(raw) ?? {}).forEach(([name, text]) => {
    if (typeof text !== 'string') {
      errors.push(`nodes.yml "${name}": expected text.`);
      return;
    }
    if (i18nTextCheck(`nodes.yml "${name}"`, text, errors, true)) {
      nodes[name] = text;
    }
  });
  return nodes;
}

// Docs are parsed YAML keyed by path inside the language folder: language.yml, ui.yml, nodes.yml, content/<type>.yml.
export function i18nLanguageParse(
  docs: Record<string, unknown>,
  contentTypes: string[],
): I18nParseResult {
  const errors: string[] = [];
  if (!('language.yml' in docs)) return { errors: ['Missing language.yml.'] };

  const info = i18nLanguageInfoParse(docs['language.yml'], errors);
  if (!info) return { errors };

  const { content, sources } = i18nContentParse(docs, contentTypes, errors);
  const { [SOURCE_KEY]: uiSourcesRaw, ...uiDoc } =
    asRecord(docs['ui.yml']) ?? {};
  const uiSources = i18nSourcesParse(uiSourcesRaw);
  return {
    language: {
      ...info,
      ui: i18nDropUntranslated(i18nFlatten(uiDoc, 'ui.yml', errors), uiSources),
      content,
      nodes: i18nNodesParse(docs['nodes.yml'], errors),
      sources,
      uiSources,
    },
    errors,
  };
}
