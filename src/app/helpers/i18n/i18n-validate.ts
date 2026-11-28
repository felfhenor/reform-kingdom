import {
  I18N_CONTENT_FIELDS,
  i18nContentFieldText,
} from '@helpers/i18n/i18n-fields';
import { i18nPlaceholdersMatch } from '@helpers/i18n/i18n-text';
import type {
  I18nContentFields,
  I18nEnglishContentLookup,
  I18nFlatStrings,
  I18nLanguageData,
  I18nValidateResult,
} from '@interfaces';

function i18nValidateUi(
  ui: I18nFlatStrings,
  uiSources: I18nFlatStrings,
  englishUi: I18nFlatStrings,
  result: I18nValidateResult,
): void {
  Object.entries(ui).forEach(([key, text]) => {
    const english = englishUi[key];
    if (english === undefined) {
      result.warnings.push(`ui.yml ${key}: not a key in the game.`);
      return;
    }
    if (uiSources[key] !== undefined && uiSources[key] !== english) {
      result.warnings.push(
        `ui.yml ${key}: the English text has changed since this was translated.`,
      );
    }
    if (!i18nPlaceholdersMatch(english, text)) {
      result.errors.push(
        `ui.yml ${key}: {{ }} placeholders differ from English.`,
      );
    }
  });
}

function i18nValidateEntry(
  where: string,
  entry: Record<string, unknown>,
  fields: I18nContentFields,
  sources: I18nContentFields,
  result: I18nValidateResult,
): void {
  Object.entries(fields).forEach(([path, text]) => {
    const english = i18nContentFieldText(entry, path);
    const field = path.split('.').pop() ?? '';
    if (english === undefined || !I18N_CONTENT_FIELDS.includes(field)) {
      result.warnings.push(`${where} ${path}: not translatable text.`);
      return;
    }
    if (!i18nPlaceholdersMatch(english, text)) {
      result.errors.push(
        `${where} ${path}: {{ }} placeholders differ from English.`,
      );
    }
    if (sources[path] !== undefined && sources[path] !== english) {
      result.warnings.push(
        `${where} ${path}: the English text has changed since this was translated.`,
      );
    }
  });
}

export function i18nValidate(
  language: I18nLanguageData,
  englishUi: I18nFlatStrings,
  englishContent: I18nEnglishContentLookup,
  englishNodes: string[],
): I18nValidateResult {
  const result: I18nValidateResult = { errors: [], warnings: [] };
  i18nValidateUi(language.ui, language.uiSources, englishUi, result);

  Object.entries(language.content).forEach(([type, entries]) => {
    Object.entries(entries).forEach(([name, fields]) => {
      const where = `content/${type}.yml "${name}"`;
      const entry = englishContent(type, name);
      if (!entry) {
        result.warnings.push(`${where}: no ${type} has this name.`);
        return;
      }
      const sources = language.sources[type]?.[name] ?? {};
      i18nValidateEntry(where, entry, fields, sources, result);
    });
  });

  Object.keys(language.nodes)
    .filter((name) => !englishNodes.includes(name))
    .forEach((name) =>
      result.warnings.push(`nodes.yml "${name}": no map node has this name.`),
    );

  return result;
}
