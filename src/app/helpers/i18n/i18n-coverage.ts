import {
  I18N_CHANGED_WARNING,
  I18N_PLURAL_FORM,
  i18nValidate,
} from '@helpers/i18n/i18n-validate';
import { set } from 'es-toolkit/compat';
import type {
  I18nCoverageLine,
  I18nCoverageReport,
  I18nEnglishContentLookup,
  I18nEnglishSnapshot,
  I18nFlatStrings,
  I18nLanguageData,
  I18nPatchFiles,
} from '@interfaces';

// A plural form the language never picks (e.g. `one` in Japanese) needs no line.
function i18nIsUnusedPluralForm(
  key: string,
  english: I18nFlatStrings,
  used: string[],
): boolean {
  const form = I18N_PLURAL_FORM.exec(key)?.[1];
  if (!form || used.includes(form)) return false;
  return english[key.replace(I18N_PLURAL_FORM, '.other')] !== undefined;
}

function i18nCoverageSort(
  report: I18nCoverageReport,
  line: I18nCoverageLine,
  text: string | undefined,
  source: string | undefined,
): void {
  report.total += 1;
  if (text === undefined && source === undefined) report.missing.push(line);
  else if (source !== undefined && source !== line.english)
    report.outdated.push({ ...line, previousEnglish: source });
  // The parser drops copies still matching their `_en`, leaving only the source behind.
  else if ((text ?? source) === line.english) report.unchanged.push(line);
}

function i18nCoverageUi(
  language: I18nLanguageData,
  english: I18nFlatStrings,
  report: I18nCoverageReport,
): void {
  const used: string[] = new Intl.PluralRules(language.locale).resolvedOptions()
    .pluralCategories;
  Object.entries(english).forEach(([key, text]) => {
    if (i18nIsUnusedPluralForm(key, english, used)) return;
    const line = { file: 'ui.yml', key, english: text };
    i18nCoverageSort(report, line, language.ui[key], language.uiSources[key]);
  });
}

function i18nCoverageContent(
  language: I18nLanguageData,
  english: I18nEnglishSnapshot['content'],
  report: I18nCoverageReport,
): void {
  Object.entries(english).forEach(([type, entries]) => {
    Object.entries(entries).forEach(([entry, fields]) => {
      Object.entries(fields).forEach(([key, text]) => {
        const line = { file: `content/${type}.yml`, entry, key, english: text };
        const translated = language.content[type]?.[entry]?.[key];
        const source = language.sources[type]?.[entry]?.[key];
        i18nCoverageSort(report, line, translated, source);
      });
    });
  });
}

function i18nCoverageNodes(
  language: I18nLanguageData,
  english: string[],
  report: I18nCoverageReport,
): void {
  english.forEach((name) => {
    const line = { file: 'nodes.yml', key: name, english: name };
    i18nCoverageSort(report, line, language.nodes[name], undefined);
  });
}

// Changed English gets its own list with the old text, so the validator's copy of it is dropped.
function i18nCoverageProblems(
  language: I18nLanguageData,
  english: I18nEnglishSnapshot,
  englishContent: I18nEnglishContentLookup,
): string[] {
  const { errors, warnings } = i18nValidate(
    language,
    english.ui,
    englishContent,
    english.nodes,
  );
  return [
    ...errors,
    ...warnings.filter((warning) => !warning.endsWith(I18N_CHANGED_WARNING)),
  ];
}

export function i18nCoverage(
  language: I18nLanguageData,
  english: I18nEnglishSnapshot,
  englishContent: I18nEnglishContentLookup,
): I18nCoverageReport {
  const report: I18nCoverageReport = {
    locale: language.locale,
    languageName: language.languageName,
    total: 0,
    missing: [],
    unchanged: [],
    outdated: [],
    problems: i18nCoverageProblems(language, english, englishContent),
  };
  i18nCoverageUi(language, english.ui, report);
  i18nCoverageContent(language, english.content, report);
  i18nCoverageNodes(language, english.nodes, report);
  return report;
}

// Lines go in English with their `_en` source, keyed like the translation files so each merges into its place.
function i18nPatchLine(
  file: Record<string, unknown>,
  line: I18nCoverageLine,
): void {
  if (line.file === 'nodes.yml') {
    file[line.key] = line.english;
    return;
  }
  const target = line.entry
    ? ((file[line.entry] ??= {}) as Record<string, unknown>)
    : file;
  if (line.entry) target[line.key] = line.english;
  else set(target, line.key, line.english);
  set(target, ['_en', line.key], line.english);
}

export function i18nCoveragePatch(report: I18nCoverageReport): I18nPatchFiles {
  const files: I18nPatchFiles = {};
  [...report.missing, ...report.outdated].forEach((line) =>
    i18nPatchLine((files[line.file] ??= {}), line),
  );
  return files;
}
