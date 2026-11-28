import {
  i18nEnglishLayer,
  i18nLanguageLayer,
  i18nResetToEnglish,
} from '@/testing/i18n';
import { t } from '@helpers/i18n/i18n';
import {
  languageChoice,
  languageEnglishOnlyApply,
  languageModApply,
  setI18nBaseLayers,
} from '@helpers/i18n/i18n-language';
import { setOption } from '@helpers/state-options';
import type { I18nKey, LanguageChoice } from '@interfaces';
import { afterEach, describe, expect, it } from 'vitest';

const key = (k: string) => k as I18nKey;

afterEach(() => {
  setOption('language', { source: 'base', locale: 'en' });
  setI18nBaseLayers([]);
  i18nResetToEnglish();
});

describe('languageChoice', () => {
  it('defaults to English when the option was never saved', () => {
    setOption('language', undefined as unknown as LanguageChoice);

    expect(languageChoice()).toEqual({ source: 'base', locale: 'en' });
  });
});

describe('layering', () => {
  const english = { ...i18nEnglishLayer(), ui: { a: 'A', b: 'B', c: 'C' } };
  const shippedFrench = i18nLanguageLayer({ ui: { b: 'B fr', c: 'C fr' } });
  const modFrench = i18nLanguageLayer({ ui: { c: 'C mod' } });

  it('puts a mod on top of English and the shipped locale', () => {
    setI18nBaseLayers([english, shippedFrench]);
    languageModApply(modFrench);

    expect([t(key('a')), t(key('b')), t(key('c'))]).toEqual([
      'A',
      'B fr',
      'C mod',
    ]);
  });

  it('can fall back to English alone', () => {
    setI18nBaseLayers([english, shippedFrench]);
    languageEnglishOnlyApply();

    expect(t(key('b'))).toBe('B');
  });
});
