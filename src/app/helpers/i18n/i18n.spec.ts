import {
  i18nEnglishLayer,
  i18nLanguageLayer,
  i18nResetToEnglish,
} from '@/testing/i18n';
import {
  i18nLayersApply,
  i18nList,
  i18nLocale,
  t,
  tPlural,
} from '@helpers/i18n/i18n';
import type { I18nKey, I18nPluralKey } from '@interfaces';
import { afterEach, describe, expect, it } from 'vitest';

const key = (k: string) => k as I18nKey;
const pluralKey = (k: string) => k as I18nPluralKey;

afterEach(() => i18nResetToEnglish());

describe('t', () => {
  it('fills placeholders and leaves unknown ones as written', () => {
    i18nLayersApply([
      i18nLanguageLayer({ ui: { greet: 'Hi {{ name }}, {{ other }}' } }),
    ]);

    expect(t(key('greet'), { name: 'Ana' })).toBe('Hi Ana, {{ other }}');
  });

  it('shows the key when no layer has the text', () => {
    i18nLayersApply([i18nLanguageLayer({})]);

    expect(t(key('missing.key'))).toBe('missing.key');
  });

  it('lets later layers override earlier ones line by line', () => {
    i18nLayersApply([
      i18nLanguageLayer({ locale: 'en', ui: { a: 'A', b: 'B' } }),
      i18nLanguageLayer({ ui: { b: 'Bé' } }),
    ]);

    expect([t(key('a')), t(key('b'))]).toEqual(['A', 'Bé']);
    expect(i18nLocale()).toBe('fr');
  });

  it('reads the real English text in specs', () => {
    expect(t('options.language.title')).toBe('Language');
  });
});

describe('tPlural', () => {
  const forms = {
    'item.one': '{{ count }} item',
    'item.other': '{{ count }} items',
  };

  it('picks the form for the count', () => {
    i18nLayersApply([i18nLanguageLayer({ locale: 'en', ui: forms })]);

    expect(tPlural(pluralKey('item'), 1)).toBe('1 item');
    expect(tPlural(pluralKey('item'), 3)).toBe('3 items');
  });

  it('follows the locale rules, so French zero is singular', () => {
    i18nLayersApply([i18nLanguageLayer({ ui: forms })]);

    expect(tPlural(pluralKey('item'), 0)).toBe('0 item');
  });

  it('falls back to the other form', () => {
    i18nLayersApply([
      i18nLanguageLayer({ locale: 'en', ui: { 'x.other': 'many' } }),
    ]);

    expect(tPlural(pluralKey('x'), 1)).toBe('many');
  });
});

describe('i18nList', () => {
  it('joins with the locale conjunction', () => {
    i18nLayersApply([i18nEnglishLayer()]);

    expect(i18nList(['a', 'b', 'c'], 'and')).toBe('a, b, and c');
    expect(i18nList(['a', 'b'], 'or')).toBe('a or b');
  });
});
