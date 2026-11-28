import {
  i18nFlatten,
  i18nLanguageParse,
  i18nPluralKeys,
} from '@helpers/i18n/i18n-parse';
import { describe, expect, it } from 'vitest';

const LANGUAGE = { locale: 'fr', languageName: 'Français' };

describe('i18nLanguageParse', () => {
  it('needs language.yml', () => {
    expect(i18nLanguageParse({}, []).errors).toEqual(['Missing language.yml.']);
  });

  it('rejects a malformed locale and canonicalizes a valid one', () => {
    expect(
      i18nLanguageParse(
        { 'language.yml': { locale: 'fr_FR', languageName: 'x' } },
        [],
      ).errors,
    ).toHaveLength(1);

    const { language } = i18nLanguageParse(
      { 'language.yml': { locale: 'PT-br', languageName: 'Português' } },
      [],
    );
    expect(language?.locale).toBe('pt-BR');
  });

  it('reads ui, content, sources and nodes', () => {
    const { language, errors } = i18nLanguageParse(
      {
        'language.yml': LANGUAGE,
        'ui.yml': { mods: { useLanguage: 'Utiliser' } },
        'content/skill.yml': {
          Fireball: {
            name: 'Boule de feu',
            'techniques.0.combatMessage': '**{{ a }}** brûle',
            _en: { 'techniques.0.combatMessage': '**{{ a }}** burns' },
          },
        },
        'nodes.yml': { 'Old Mill': 'Vieux moulin' },
      },
      ['skill'],
    );

    expect(errors).toEqual([]);
    expect(language?.ui).toEqual({ 'mods.useLanguage': 'Utiliser' });
    expect(language?.content['skill']['Fireball']).toEqual({
      name: 'Boule de feu',
      'techniques.0.combatMessage': '**{{ a }}** brûle',
    });
    expect(language?.sources['skill']['Fireball']).toEqual({
      'techniques.0.combatMessage': '**{{ a }}** burns',
    });
    expect(language?.nodes).toEqual({ 'Old Mill': 'Vieux moulin' });
  });

  it('rejects markup, ** in names, and unpaired **', () => {
    const { errors, language } = i18nLanguageParse(
      {
        'language.yml': LANGUAGE,
        'ui.yml': { a: '<b>x</b>', b: 'one ** two' },
        'content/skill.yml': { Fireball: { name: '**Boule**' } },
        'nodes.yml': { Mill: '@@x@@' },
      },
      ['skill'],
    );

    expect(errors).toHaveLength(4);
    expect(language?.ui).toEqual({});
    expect(language?.content['skill']['Fireball']).toEqual({});
  });

  it('rejects text with a broken {{ }} placeholder', () => {
    const { errors } = i18nLanguageParse(
      {
        'language.yml': LANGUAGE,
        'content/skill.yml': {
          Fireball: { 'techniques.0.combatMessage': '{{{ damage }}' },
        },
      },
      ['skill'],
    );

    expect(errors).toHaveLength(1);
  });

  it('drops lines still equal to the English they were copied from', () => {
    const { language } = i18nLanguageParse(
      {
        'language.yml': LANGUAGE,
        'ui.yml': {
          a: 'Copied',
          b: 'Traduit',
          _en: { a: 'Copied', b: 'Translated' },
        },
        'content/skill.yml': {
          Fireball: {
            name: 'Fireball',
            description: 'Brûle.',
            _en: { name: 'Fireball', description: 'Burns.' },
          },
        },
      },
      ['skill'],
    );

    expect(language?.ui).toEqual({ b: 'Traduit' });
    expect(language?.uiSources).toEqual({ a: 'Copied', b: 'Translated' });
    expect(language?.content['skill']['Fireball']).toEqual({
      description: 'Brûle.',
    });
  });

  it('rejects unknown content types', () => {
    const { errors } = i18nLanguageParse(
      { 'language.yml': LANGUAGE, 'content/nope.yml': {} },
      ['skill'],
    );

    expect(errors).toEqual(['content/nope.yml: "nope" is not a content type.']);
  });
});

describe('i18nFlatten', () => {
  it('turns nesting and plural blocks into dotted keys', () => {
    const errors: string[] = [];
    expect(
      i18nFlatten(
        { a: { b: 'x', items: { one: '1 item', other: 'items' } } },
        'ui.yml',
        errors,
      ),
    ).toEqual({
      'a.b': 'x',
      'a.items.one': '1 item',
      'a.items.other': 'items',
    });
    expect(errors).toEqual([]);
  });
});

describe('i18nPluralKeys', () => {
  it('finds plural blocks', () => {
    expect(
      i18nPluralKeys({ a: { items: { one: 'x', other: 'y' }, b: 'z' } }),
    ).toEqual(['a.items']);
  });
});
