import { i18nLayersApply } from '@helpers/i18n/i18n';
import { i18nFlatten } from '@helpers/i18n/i18n-parse';
import type { I18nLanguageData } from '@interfaces';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';

export function i18nEnglishLayer(): I18nLanguageData {
  return {
    locale: 'en',
    languageName: 'English',
    ui: i18nFlatten(
      load(readFileSync('gamedata/i18n/en/ui.yml', 'utf-8')),
      'ui.yml',
      [],
    ),
    content: {},
    nodes: {},
    sources: {},
    uiSources: {},
  };
}

export function i18nLanguageLayer(
  overrides: Partial<I18nLanguageData>,
): I18nLanguageData {
  return {
    locale: 'fr',
    languageName: 'Français',
    ui: {},
    content: {},
    nodes: {},
    sources: {},
    uiSources: {},
    ...overrides,
  };
}

// Specs that switch language put English back, since the setup file applies it only once.
export function i18nResetToEnglish(): void {
  i18nLayersApply([i18nEnglishLayer()]);
}
