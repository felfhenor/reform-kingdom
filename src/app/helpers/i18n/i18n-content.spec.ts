import { seedContent } from '@/testing/content';
import { i18nLanguageLayer, i18nResetToEnglish } from '@/testing/i18n';
import { i18nLayersApply } from '@helpers/i18n/i18n';
import {
  contentDescription,
  contentName,
  contentNameById,
  contentNestedText,
  contentSearchFn,
  contentText,
  nodeNameText,
} from '@helpers/i18n/i18n-content';
import type { IsContentItem } from '@interfaces';
import { afterEach, describe, expect, it } from 'vitest';

const skill = {
  id: 'fireball',
  name: 'Fireball',
  __type: 'skill',
  description: 'Burns.',
  techniques: [{ combatMessage: 'A' }, { combatMessage: 'B' }],
} as unknown as IsContentItem & { techniques: { combatMessage: string }[] };

function french() {
  i18nLayersApply([
    i18nLanguageLayer({
      content: {
        skill: {
          Fireball: {
            name: 'Boule de feu',
            'techniques.1.combatMessage': 'B fr',
          },
        },
      },
      nodes: { 'Old Mill': 'Vieux moulin' },
    }),
  ]);
}

afterEach(() => i18nResetToEnglish());

describe('contentText', () => {
  it('uses the translation, keyed by English name', () => {
    french();

    expect(contentName(skill)).toBe('Boule de feu');
    expect(skill.name).toBe('Fireball');
  });

  it('falls back to the entry text', () => {
    french();

    expect(contentDescription(skill)).toBe('Burns.');
    expect(contentText(skill, 'techniques.0.combatMessage')).toBe('A');
  });

  it('returns empty text for a field the entry lacks', () => {
    expect(contentText(skill, 'legend')).toBe('');
  });
});

describe('contentNestedText', () => {
  it('matches by English text, so modified copies still translate', () => {
    seedContent([skill]);
    french();
    const copy = {
      ...skill,
      techniques: skill.techniques.map((x) => ({ ...x })),
    };

    expect(contentNestedText(copy, 'combatMessage', 'B')).toBe('B fr');
    expect(contentNestedText(copy, 'combatMessage', 'A')).toBe('A');
  });

  it('keeps text it cannot find in the entry', () => {
    french();

    expect(contentNestedText(skill, 'combatMessage', 'C')).toBe('C');
  });
});

describe('contentNameById', () => {
  it('translates a known id and skips unknown ones', () => {
    seedContent([skill]);
    french();

    expect(contentNameById('fireball')).toBe('Boule de feu');
    expect(contentNameById('nope')).toBeUndefined();
  });
});

describe('contentSearchFn', () => {
  it('matches the translated name', () => {
    french();

    expect(contentSearchFn('boule', skill)).toBe(true);
    expect(contentSearchFn('fireball', skill)).toBe(false);
  });
});

describe('nodeNameText', () => {
  it('translates node names and keeps unknown ones', () => {
    french();

    expect(nodeNameText('Old Mill')).toBe('Vieux moulin');
    expect(nodeNameText('Elsewhere')).toBe('Elsewhere');
  });
});
