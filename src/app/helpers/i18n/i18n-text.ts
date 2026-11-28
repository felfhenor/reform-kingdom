import type { I18nParams } from '@interfaces';
import mustache from 'mustache';
import { sortBy, uniq } from 'es-toolkit/compat';

const PLACEHOLDER_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

// Log lines are HTML with `**bold**` and `@@id@@` tokens; names get bolded, so they can't carry `**` themselves.
const FORBIDDEN_TEXT_PATTERN = /<\/?[A-Za-z!]|@@/;
const BOLD_MARK_PATTERN = /\*\*/g;
const NAME_FIELDS = ['name', 'shortName', 'legendName'];

export const I18N_PLURAL_FORMS: string[] = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];

export function i18nIsNameField(path: string): boolean {
  return NAME_FIELDS.includes(path.split('.').pop() ?? '');
}

export function i18nHasForbiddenText(text: string, isName: boolean): boolean {
  const boldMarks = text.match(BOLD_MARK_PATTERN)?.length ?? 0;
  return (
    FORBIDDEN_TEXT_PATTERN.test(text) ||
    (isName ? boldMarks > 0 : boldMarks % 2 !== 0)
  );
}

// Content text is rendered with Mustache in combat, where a broken tag would throw on every hit.
export function i18nIsValidTemplate(text: string): boolean {
  try {
    mustache.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function i18nPlaceholders(text: string): string[] {
  return sortBy(uniq([...text.matchAll(PLACEHOLDER_PATTERN)].map((m) => m[1])));
}

export function i18nPlaceholdersMatch(english: string, text: string): boolean {
  return (
    i18nPlaceholders(english).join(',') === i18nPlaceholders(text).join(',')
  );
}

// Plain substitution; content prose with Mustache sections still goes through combatFormatMessage.
export function i18nFill(template: string, params: I18nParams = {}): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) =>
    key in params ? String(params[key] ?? '') : match,
  );
}

export function i18nIsPluralForms(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.includes('other') &&
    keys.every((key) => I18N_PLURAL_FORMS.includes(key))
  );
}
