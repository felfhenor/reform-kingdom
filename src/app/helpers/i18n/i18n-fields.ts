import { contentShortNameEnglish } from '@helpers/content/content-short-name';
import type { I18nContentFields, TiledLayer, TiledMap } from '@interfaces';
import { get } from 'es-toolkit/compat';

// Player-facing prose fields in gamedata; everything else is a reference or a number.
export const I18N_CONTENT_FIELDS: string[] = [
  'name',
  'shortName',
  'actionLabel',
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
      // Ensured content fills unset prose with '', which has nothing to translate.
      if (child !== '') out[[...path, key].join('.')] = child;
      return;
    }
    i18nCollectFields(child, [...path, key], out);
  });
}

// Not stored on entries, so translators still need a line for it.
function i18nShortName(entry: unknown, type?: string): string | undefined {
  const name = (entry as { name?: unknown } | undefined)?.name;
  return type && typeof name === 'string'
    ? contentShortNameEnglish(type, name)
    : undefined;
}

export function i18nContentFields(
  entry: unknown,
  type?: string,
): I18nContentFields {
  const out: I18nContentFields = {};
  i18nCollectFields(entry, [], out);
  const shortName = i18nShortName(entry, type);
  return shortName === undefined ? out : { ...out, shortName };
}

export function i18nContentFieldText(
  entry: unknown,
  path: string,
  type?: string,
): string | undefined {
  if (path === 'shortName') return i18nShortName(entry, type);
  const value: unknown = get(entry, path);
  return typeof value === 'string' ? value : undefined;
}

// Every named object on a map, group layers included: the names nodes.yml translates.
export function i18nTiledObjectNames(map: Pick<TiledMap, 'layers'>): string[] {
  const collect = (layers: TiledLayer[] = []): string[] =>
    layers.flatMap((layer) => [
      ...(layer.objects ?? []).map((object) => object.name),
      ...collect(layer.layers),
    ]);
  return collect(map.layers).filter(Boolean);
}
