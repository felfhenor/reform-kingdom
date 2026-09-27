import { changelogSplitSections } from '@helpers/engine/changelog.ui';
import { describe, expect, it } from 'vitest';

describe('changelogSplitSections', () => {
  it('splits before every version heading, keeping each version with its body', () => {
    const html =
      '<h1 class="text-xl">0.2.0</h1><h3>Features</h3><ul><li>b</li></ul><h1 class="text-xl">0.1.0</h1><ul><li>a</li></ul>';

    expect(changelogSplitSections(html)).toEqual([
      '<h1 class="text-xl">0.2.0</h1><h3>Features</h3><ul><li>b</li></ul>',
      '<h1 class="text-xl">0.1.0</h1><ul><li>a</li></ul>',
    ]);
  });

  it('keeps preamble before the first version as its own section', () => {
    expect(changelogSplitSections('<p>intro</p><h1>0.1.0</h1>')).toEqual([
      '<p>intro</p>',
      '<h1>0.1.0</h1>',
    ]);
  });

  it('returns no sections for empty or whitespace-only html', () => {
    expect(changelogSplitSections('')).toEqual([]);
    expect(changelogSplitSections('  \n ')).toEqual([]);
  });

  it('does not split on headings that only start with h1, like <h10>', () => {
    expect(changelogSplitSections('<h1>a</h1><h10>x</h10>')).toEqual([
      '<h1>a</h1><h10>x</h10>',
    ]);
  });
});
