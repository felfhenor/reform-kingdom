import {
  contentRefsOf,
  contentRefsRewrite,
} from '@helpers/content/content-refs';
import { describe, expect, it } from 'vitest';

const TYPES = ['item', 'skill', 'tradeskill'];
const upper = (name: string) => name.toUpperCase();

describe('contentRefsRewrite', () => {
  it('rewrites id keys, preferring the longest matching type', () => {
    const seen: string[] = [];
    const entry = { tradeskillId: 'smithing', itemIds: ['a', 'b'] };
    contentRefsRewrite(entry, TYPES, (name, type) => {
      seen.push(type);
      return upper(name);
    });

    expect(entry).toEqual({ tradeskillId: 'SMITHING', itemIds: ['A', 'B'] });
    expect(seen).toEqual(['tradeskill', 'item', 'item']);
  });

  it('leaves Any alone and recurses into nested objects and arrays', () => {
    const entry = {
      itemId: 'Any',
      drops: [{ itemId: 'x' }],
      result: { itemId: 'y' },
      items: ['z'],
    };
    contentRefsRewrite(entry, TYPES, upper);

    expect(entry).toEqual({
      itemId: 'Any',
      drops: [{ itemId: 'X' }],
      result: { itemId: 'Y' },
      items: ['Z'],
    });
  });
});

describe('contentRefsOf', () => {
  it('collects refs without changing the entry', () => {
    const entry = { itemId: 'Ore' };
    expect(contentRefsOf(entry, TYPES)).toEqual([
      { folder: 'item', name: 'Ore' },
    ]);
    expect(entry.itemId).toBe('Ore');
  });
});
