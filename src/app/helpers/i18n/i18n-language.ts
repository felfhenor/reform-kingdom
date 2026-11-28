import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import { i18nLayersApply } from '@helpers/i18n/i18n';
import { getOption, setOption } from '@helpers/state-options';
import type {
  I18nLanguageData,
  I18nLanguageInfo,
  LanguageChoice,
} from '@interfaces';

export const I18N_BASE_LOCALE = 'en';

const _i18nLanguages = signal<I18nLanguageInfo[]>([]);
export const i18nLanguages: Signal<I18nLanguageInfo[]> =
  _i18nLanguages.asReadonly();

const _i18nBaseLayers = signal<I18nLanguageData[]>([]);
export const i18nBaseLayers: Signal<I18nLanguageData[]> =
  _i18nBaseLayers.asReadonly();

export function languageDefault(): LanguageChoice {
  return { source: 'base', locale: I18N_BASE_LOCALE };
}

// Options load before the savefile migration fills in new defaults, so this can be unset on older installs.
export function languageChoice(): LanguageChoice {
  return getOption('language') ?? languageDefault();
}

export function languageChoiceKey(choice: LanguageChoice): string {
  return choice.source === 'base'
    ? `base:${choice.locale}`
    : `mod:${choice.modId}`;
}

export function languageReset(): void {
  setOption('language', languageDefault());
}

export function setI18nLanguages(languages: I18nLanguageInfo[]): void {
  _i18nLanguages.set(languages);
}

export function setI18nBaseLayers(layers: I18nLanguageData[]): void {
  _i18nBaseLayers.set(layers);
}

export function languageEnglishOnlyApply(): void {
  i18nLayersApply(_i18nBaseLayers().slice(0, 1));
}

export function languageModApply(translations: I18nLanguageData): void {
  i18nLayersApply([..._i18nBaseLayers(), translations]);
}
