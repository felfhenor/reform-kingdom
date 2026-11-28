import {
  i18nEnglishLayer,
  i18nLanguageLayer,
  i18nResetToEnglish,
} from '@/testing/i18n';
import { t } from '@helpers/i18n/i18n';
import {
  languageBaseApply,
  languageBaseLocaleToLoad,
  languageChoice,
  languageEnglishOnlyApply,
  languageModApply,
} from '@helpers/i18n/i18n-language';
import { setOption } from '@helpers/state-options';
import type { I18nKey, LanguageChoice } from '@interfaces';
import { afterEach, describe, expect, it } from 'vitest';

const LANGUAGES = [
  { locale: 'en', languageName: 'English' },
  { locale: 'fr', languageName: 'Français' },
];
const key = (k: string) => k as I18nKey;

afterEach(() => {
  setOption('language', { source: 'base', locale: 'en' });
  i18nResetToEnglish();
});

describe('languageChoice', () => {
  it('defaults to English when the option was never saved', () => {
    setOption('language', undefined as unknown as LanguageChoice);

    expect(languageChoice()).toEqual({ source: 'base', locale: 'en' });
  });
});

describe('languageBaseLocaleToLoad', () => {
  it('loads a shipped locale for base and mod choices alike', () => {
    expect(
      languageBaseLocaleToLoad({ source: 'base', locale: 'fr' }, LANGUAGES),
    ).toBe('fr');
    expect(
      languageBaseLocaleToLoad(
        { source: 'mod', modId: 'x', locale: 'fr' },
        LANGUAGES,
      ),
    ).toBe('fr');
  });

  it('loads nothing extra for English or an unshipped locale', () => {
    expect(
      languageBaseLocaleToLoad({ source: 'base', locale: 'en' }, LANGUAGES),
    ).toBeUndefined();
    expect(
      languageBaseLocaleToLoad(
        { source: 'mod', modId: 'x', locale: 'de' },
        LANGUAGES,
      ),
    ).toBeUndefined();
  });
});

describe('layering', () => {
  const english = { ...i18nEnglishLayer(), ui: { a: 'A', b: 'B', c: 'C' } };
  const shippedFrench = i18nLanguageLayer({ ui: { b: 'B fr', c: 'C fr' } });
  const modFrench = i18nLanguageLayer({ ui: { c: 'C mod' } });

  it('stacks English, then the shipped locale, then the mod', () => {
    languageBaseApply(LANGUAGES, [english, shippedFrench]);
    languageModApply(modFrench);

    expect([t(key('a')), t(key('b')), t(key('c'))]).toEqual([
      'A',
      'B fr',
      'C mod',
    ]);
  });

  it('can fall back to English alone', () => {
    languageBaseApply(LANGUAGES, [english, shippedFrench]);
    languageEnglishOnlyApply();

    expect(t(key('b'))).toBe('B');
  });
});
