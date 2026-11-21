import { ffGroupSelectOptions } from '@ff/controls/ff-select-groups';
import { describe, expect, it } from 'vitest';

describe('ffGroupSelectOptions', () => {
  it('keeps ungrouped options in one headerless group', () => {
    const a = { label: 'a' };
    const b = { label: 'b' };
    expect(ffGroupSelectOptions([a, b])).toEqual([{ items: [a, b] }]);
  });

  it('starts a new group at each header option', () => {
    const header1 = { label: 'Smithing', children: [] };
    const x = { label: 'x' };
    const header2 = { label: 'Tailoring', children: [] };
    const y = { label: 'y' };
    expect(ffGroupSelectOptions([header1, x, header2, y])).toEqual([
      { header: header1, items: [x] },
      { header: header2, items: [y] },
    ]);
  });
});
