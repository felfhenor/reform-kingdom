import {
  ffSelectTitleFromPlaceholder,
  ffTitleCase,
} from '@ff/controls/ff-select-title';
import { describe, expect, it } from 'vitest';

describe('ffSelectTitleFromPlaceholder', () => {
  it.each([
    ['Select a gather location...', 'Gather Location'],
    ['Select a recipe...', 'Recipe'],
    ['Choose an option…', 'Option'],
    ['Pick the town', 'Town'],
    ['Any town', 'Any Town'],
  ])('turns %s into %s', (placeholder, title) => {
    expect(ffSelectTitleFromPlaceholder(placeholder)).toBe(title);
  });

  it('returns undefined when nothing meaningful is left', () => {
    expect(ffSelectTitleFromPlaceholder(undefined)).toBeUndefined();
    expect(ffSelectTitleFromPlaceholder('Select a ...')).toBeUndefined();
  });
});

describe('ffTitleCase', () => {
  it('capitalizes every word', () => {
    expect(ffTitleCase('minimum item level to keep')).toBe(
      'Minimum Item Level To Keep',
    );
  });
});
