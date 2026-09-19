import { deepFreeze } from '@helpers/engine/deep-freeze';
import { dictionaryWith, dictionaryWithout } from '@helpers/engine/dictionary';
import { describe, expect, it } from 'vitest';

describe('dictionaryWith', () => {
  it('returns a new dictionary with the entry added, leaving the original untouched', () => {
    const original: Record<string, { n: number }> = deepFreeze({ a: { n: 1 } });

    const result = dictionaryWith(original, 'b', { n: 2 });

    expect(result).not.toBe(original);
    expect(result).toEqual({ a: { n: 1 }, b: { n: 2 } });
    expect(original).toEqual({ a: { n: 1 } });
  });

  it('replaces an existing entry', () => {
    const original = deepFreeze({ a: { n: 1 } });

    expect(dictionaryWith(original, 'a', { n: 9 })).toEqual({ a: { n: 9 } });
  });

  it('keeps the other entries reference-stable', () => {
    const original = deepFreeze({ a: { n: 1 }, b: { n: 2 } });

    expect(dictionaryWith(original, 'a', { n: 9 }).b).toBe(original.b);
  });
});

describe('dictionaryWithout', () => {
  it('returns a new dictionary without the key, leaving the original untouched', () => {
    const original = deepFreeze({ a: { n: 1 }, b: { n: 2 } });

    const result = dictionaryWithout(original, 'a');

    expect(result).not.toBe(original);
    expect(result).toEqual({ b: { n: 2 } });
    expect(original).toEqual({ a: { n: 1 }, b: { n: 2 } });
  });

  it('keeps the remaining entries reference-stable', () => {
    const original = deepFreeze({ a: { n: 1 }, b: { n: 2 } });

    expect(dictionaryWithout(original, 'a').b).toBe(original.b);
  });

  it('returns the same dictionary when the key is absent', () => {
    const original: Record<string, { n: number }> = deepFreeze({ a: { n: 1 } });

    expect(dictionaryWithout(original, 'missing')).toBe(original);
  });
});
