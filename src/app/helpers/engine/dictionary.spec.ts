import { deepFreeze } from '@helpers/engine/deep-freeze';
import { dictionaryWithout } from '@helpers/engine/dictionary';
import { describe, expect, it } from 'vitest';

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
