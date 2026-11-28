import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import { i18nFill } from '@helpers/i18n/i18n-text';
import type {
  I18nContentTranslations,
  I18nEnumGroup,
  I18nFlatStrings,
  I18nKey,
  I18nLanguageData,
  I18nListType,
  I18nParams,
  I18nPluralKey,
} from '@interfaces';
import { merge } from 'es-toolkit/compat';

const _i18nLocale = signal<string>('en');
export const i18nLocale: Signal<string> = _i18nLocale.asReadonly();

const _i18nUi = signal<I18nFlatStrings>({});
const _i18nContent = signal<I18nContentTranslations>({});
export const i18nContent: Signal<I18nContentTranslations> =
  _i18nContent.asReadonly();

const _i18nNodes = signal<I18nFlatStrings>({});
export const i18nNodes: Signal<I18nFlatStrings> = _i18nNodes.asReadonly();

// Later layers win, so English goes first and a partial translation falls back to it line by line.
export function i18nLayersApply(layers: I18nLanguageData[]): void {
  _i18nUi.set(Object.assign({}, ...layers.map((layer) => layer.ui)));
  _i18nContent.set(merge({}, ...layers.map((layer) => layer.content)));
  _i18nNodes.set(Object.assign({}, ...layers.map((layer) => layer.nodes)));
  _i18nLocale.set(layers.at(-1)?.locale ?? 'en');
}

export function t(key: I18nKey, params?: I18nParams): string {
  return i18nFill(_i18nUi()[key] ?? key, params);
}

// Label tables are created when their module loads, before any language does, so each read looks its text up then.
export function i18nLabels<K extends string>(
  prefix: string,
  keys: readonly K[],
): Record<K, string> {
  const label = (key: K) => t(`${prefix}.${key}` as I18nKey);
  const isKey = (key: string | symbol): key is K =>
    typeof key === 'string' && keys.includes(key as K);
  return new Proxy({} as Record<K, string>, {
    get: (_, key) => (isKey(key) ? label(key) : undefined),
    has: (_, key) => isKey(key),
    ownKeys: () => [...keys],
    getOwnPropertyDescriptor: (_, key) =>
      isKey(key)
        ? { enumerable: true, configurable: true, value: label(key) }
        : undefined,
  });
}

// Enum values double as keys; a value with no label (e.g. added by a mod) shows as itself.
export function enumLabel(group: I18nEnumGroup, value: string): string {
  const key = `enum.${group}.${value}` as I18nKey;
  const text = t(key);
  return text === key ? value : text;
}

const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

function i18nPluralRules(): Intl.PluralRules {
  const locale = _i18nLocale();
  let rules = pluralRulesByLocale.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesByLocale.set(locale, rules);
  }
  return rules;
}

export function tPlural(
  key: I18nPluralKey,
  count: number,
  params?: I18nParams,
): string {
  const ui = _i18nUi();
  const form = i18nPluralRules().select(count);
  const template = ui[`${key}.${form}`] ?? ui[`${key}.other`] ?? key;
  return i18nFill(template, { count: count.toLocaleString(), ...params });
}

export function i18nList(items: string[], type: I18nListType): string {
  return new Intl.ListFormat(_i18nLocale(), {
    type: type === 'and' ? 'conjunction' : 'disjunction',
  }).format(items);
}
