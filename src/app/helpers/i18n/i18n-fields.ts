import type { I18nContentFields } from '@interfaces';
import { get } from 'es-toolkit/compat';

// Player-facing prose fields in gamedata; everything else is a reference or a number.
export const I18N_CONTENT_FIELDS: string[] = [
  'name',
  'description',
  'combatMessage',
  'emptyText',
  'legend',
  'legendName',
  'postFightWhisper',
  'rescueText',
  'whisper',
];

function i18nCollectFields(
  value: unknown,
  path: string[],
  out: I18nContentFields,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      i18nCollectFields(item, [...path, String(index)], out),
    );
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.entries(value).forEach(([key, child]) => {
    if (typeof child === 'string' && I18N_CONTENT_FIELDS.includes(key)) {
      out[[...path, key].join('.')] = child;
      return;
    }
    i18nCollectFields(child, [...path, key], out);
  });
}

export function i18nContentFields(entry: unknown): I18nContentFields {
  const out: I18nContentFields = {};
  i18nCollectFields(entry, [], out);
  return out;
}

export function i18nContentFieldText(
  entry: unknown,
  path: string,
): string | undefined {
  const value: unknown = get(entry, path);
  return typeof value === 'string' ? value : undefined;
}
