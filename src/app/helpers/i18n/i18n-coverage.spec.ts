import { i18nLanguageLayer } from '@/testing/i18n';
import { i18nCoverage, i18nCoveragePatch } from '@helpers/i18n/i18n-coverage';
import type { I18nEnglishSnapshot } from '@interfaces';
import { describe, expect, it } from 'vitest';

const english: I18nEnglishSnapshot = {
  ui: {
    'home.play': 'Play',
    'home.quit': 'Quit',
    'home.title': 'Kingdom',
    'duration.day.one': '{{ count }} day',
    'duration.day.other': '{{ count }} days',
  },
  content: { item: { Apple: { name: 'Apple', description: 'A red fruit.' } } },
  nodes: ['Carrina'],
};
const englishEntry = (type: string, name: string) =>
  type === 'item' && name === 'Apple'
    ? { name: 'Apple', description: 'A red fruit.' }
    : undefined;

describe('i18nCoverage', () => {
  it('sorts lines into missing, unchanged and outdated', () => {
    const report = i18nCoverage(
      i18nLanguageLayer({
        ui: {
          'home.play': 'Jouer',
          'home.title': 'Kingdom',
          'duration.day.other': '{{ count }} jours',
        },
        uiSources: { 'home.play': 'Play now' },
        content: { item: { Apple: { name: 'Pomme' } } },
        nodes: { Carrina: 'Carrina' },
      }),
      english,
      englishEntry,
    );

    expect(report.total).toBe(8);
    expect(report.missing.map((line) => line.key)).toEqual([
      'home.quit',
      'duration.day.one',
      'description',
    ]);
    expect(report.outdated).toEqual([
      {
        file: 'ui.yml',
        key: 'home.play',
        english: 'Play',
        previousEnglish: 'Play now',
      },
    ]);
    expect(report.unchanged.map((line) => line.key)).toEqual([
      'home.title',
      'Carrina',
    ]);
    expect(report.problems).toEqual([]);
  });

  it('skips plural forms the language never uses', () => {
    const report = i18nCoverage(
      i18nLanguageLayer({
        locale: 'ja',
        ui: { 'duration.day.other': '{{ count }}日' },
      }),
      english,
      englishEntry,
    );

    expect(report.total).toBe(7);
    expect(report.missing.map((line) => line.key)).not.toContain(
      'duration.day.one',
    );
  });

  it('keeps validator problems but not its changed-English warnings', () => {
    const report = i18nCoverage(
      i18nLanguageLayer({
        ui: { 'home.play': 'Jouer {{ x }}', 'home.nope': 'Non' },
        uiSources: { 'home.play': 'Play now' },
      }),
      english,
      englishEntry,
    );

    expect(report.problems).toHaveLength(2);
    expect(report.problems.join(' ')).not.toContain('has changed');
  });
  it('counts a line kept only as its `_en` source as the same as English', () => {
    const report = i18nCoverage(
      i18nLanguageLayer({
        uiSources: {
          'home.quit': 'Quit',
          'duration.day.one': '{{ count }} day',
        },
      }),
      english,
      englishEntry,
    );

    expect(report.unchanged.map((line) => line.key)).toContain('home.quit');
    expect(report.missing.map((line) => line.key)).not.toContain('home.quit');
    expect(report.unchanged.map((line) => line.key)).toContain(
      'duration.day.one',
    );
  });
});

describe('i18nCoveragePatch', () => {
  it('lays out missing and outdated lines like the translation files', () => {
    const report = i18nCoverage(
      i18nLanguageLayer({
        ui: {
          'home.play': 'Jouer',
          'home.title': 'Royaume',
          'duration.day.other': 'j',
        },
        uiSources: { 'home.play': 'Play now' },
        content: { item: { Apple: { name: 'Pomme' } } },
      }),
      english,
      englishEntry,
    );

    expect(i18nCoveragePatch(report)).toEqual({
      'ui.yml': {
        home: { quit: 'Quit', play: 'Play' },
        duration: { day: { one: '{{ count }} day' } },
        _en: {
          'home.quit': 'Quit',
          'duration.day.one': '{{ count }} day',
          'home.play': 'Play',
        },
      },
      'content/item.yml': {
        Apple: {
          description: 'A red fruit.',
          _en: { description: 'A red fruit.' },
        },
      },
      'nodes.yml': { Carrina: 'Carrina' },
    });
  });
});
