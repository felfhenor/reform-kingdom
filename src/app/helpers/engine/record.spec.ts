import { describe, expect, it } from 'vitest';

import { recordPrune } from '@helpers/engine/record';

describe('recordPrune', () => {
  it('keeps only the keys the predicate accepts, without mutating the input', () => {
    const record = { a: { foundAt: 1 }, b: { foundAt: 2 } };

    expect(recordPrune(record, (key) => key === 'a')).toEqual({
      a: { foundAt: 1 },
    });
    expect(Object.keys(record)).toEqual(['a', 'b']);
  });

  it('works on records of plain values', () => {
    expect(recordPrune({ ore: 5, gone: 2 }, (key) => key !== 'gone')).toEqual({
      ore: 5,
    });
  });
});
