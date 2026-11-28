import { i18nLanguageLayer } from '@/testing/i18n';
import { i18nValidate } from '@helpers/i18n/i18n-validate';
import { describe, expect, it } from 'vitest';

const ENGLISH_UI = { 'log.drop': '{{ item }} dropped.' };
const FIREBALL = {
  name: 'Fireball',
  techniques: [{ combatMessage: '**{{ a }}** burns' }],
  power: 5,
};
const english = (type: string, name: string) =>
  type === 'skill' && name === 'Fireball' ? FIREBALL : undefined;

describe('i18nValidate', () => {
  it('accepts a matching translation', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        ui: { 'log.drop': '{{ item }} est tombé.' },
        content: { skill: { Fireball: { name: 'Boule de feu' } } },
        nodes: { Mill: 'Moulin' },
      }),
      ENGLISH_UI,
      english,
      ['Mill'],
    );

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('fails on placeholders that differ from English', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        ui: { 'log.drop': '{{ objet }} est tombé.' },
        content: {
          skill: { Fireball: { 'techniques.0.combatMessage': '**{{ b }}**' } },
        },
      }),
      ENGLISH_UI,
      english,
      [],
    );

    expect(result.errors).toHaveLength(2);
  });

  it('warns on unknown keys, names, paths and nodes', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        ui: { 'gone.key': 'x' },
        content: {
          skill: {
            Fireball: { power: '6', 'techniques.3.combatMessage': 'x' },
            Icebolt: { name: 'x' },
          },
        },
        nodes: { Nowhere: 'x' },
      }),
      ENGLISH_UI,
      english,
      [],
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(5);
  });

  it('checks plural forms English lacks against its other form', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        locale: 'pl',
        ui: { 'turns.few': '{{ count }} tury', 'turns.many': '{{ n }} tur' },
      }),
      { 'turns.one': '{{ count }} turn', 'turns.other': '{{ count }} turns' },
      english,
      [],
    );

    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([
      'ui.yml turns.many: {{ }} placeholders differ from English.',
    ]);
  });

  it('warns when the English of a translated UI line has changed', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        ui: { 'log.drop': '{{ item }} est tombé.' },
        uiSources: { 'log.drop': '{{ item }} fell.' },
      }),
      ENGLISH_UI,
      english,
      [],
    );

    expect(result.warnings).toHaveLength(1);
  });

  it('warns when the English under an indexed path has changed', () => {
    const result = i18nValidate(
      i18nLanguageLayer({
        content: {
          skill: {
            Fireball: { 'techniques.0.combatMessage': '**{{ a }}** brûle' },
          },
        },
        sources: {
          skill: { Fireball: { 'techniques.0.combatMessage': 'old text' } },
        },
      }),
      ENGLISH_UI,
      english,
      [],
    );

    expect(result.warnings).toEqual([
      'content/skill.yml "Fireball" techniques.0.combatMessage: the English text has changed since this was translated.',
    ]);
  });
});
