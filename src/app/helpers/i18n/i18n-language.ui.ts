import { i18nLayersApply } from '@helpers/i18n/i18n';
import {
  I18N_BASE_LOCALE,
  setI18nBaseLayers,
  setI18nLanguages,
} from '@helpers/i18n/i18n-language';
import type {
  I18nLanguageData,
  I18nLanguageInfo,
  LanguageChoice,
} from '@interfaces';

export function languageHasBaseLocale(
  languages: I18nLanguageInfo[],
  locale: string,
): boolean {
  return languages.some((language) => language.locale === locale);
}

// A mod for a first-party language sits on top of it, so it only needs the lines it changes.
export function languageBaseLocaleToLoad(
  choice: LanguageChoice,
  languages: I18nLanguageInfo[],
): string | undefined {
  return choice.locale !== I18N_BASE_LOCALE &&
    languageHasBaseLocale(languages, choice.locale)
    ? choice.locale
    : undefined;
}

export function languageBaseApply(
  languages: I18nLanguageInfo[],
  layers: I18nLanguageData[],
): void {
  setI18nLanguages(languages);
  setI18nBaseLayers(layers);
  i18nLayersApply(layers);
}
