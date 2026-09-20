import { isSameValue, isUnchanged } from '@helpers/engine/shallow-equal';
import { describe, expect, it } from 'vitest';

describe('isSameValue', () => {
  it('is true for the same reference or primitive', () => {
    const list = [1];

    expect(isSameValue(list, list)).toBe(true);
    expect(isSameValue(3, 3)).toBe(true);
  });

  it('is true for arrays holding the same elements', () => {
    const entry = { id: 'a' };

    expect(isSameValue([entry], [entry])).toBe(true);
    expect(isSameValue([], [])).toBe(true);
  });

  it('is false for arrays that differ in length or element identity', () => {
    expect(isSameValue([1], [1, 2])).toBe(false);
    expect(isSameValue([{ id: 'a' }], [{ id: 'a' }])).toBe(false);
  });

  it('is false for equal-looking objects and mismatched types', () => {
    expect(isSameValue({ a: 1 }, { a: 1 })).toBe(false);
    expect(isSameValue([], {})).toBe(false);
  });
});

describe('isUnchanged', () => {
  it('is true when every key holds the same value', () => {
    const entry = { id: 'a' };

    expect(isUnchanged({ n: 1, list: [entry] }, { n: 1, list: [entry] })).toBe(
      true,
    );
  });

  it('is false when a value differs', () => {
    expect(isUnchanged({ n: 2 }, { n: 1 })).toBe(false);
  });

  it('is false when a key was added or removed', () => {
    expect(isUnchanged({ n: 1, extra: 1 } as object, { n: 1 })).toBe(false);
    expect(isUnchanged({ n: 1 }, { n: 1, extra: 1 } as object)).toBe(false);
  });
});
