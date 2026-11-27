import { describe, expect, it } from 'vitest';

import { ensureItem } from '@helpers/content/ensure-item';
import { defaultStats } from '@helpers/defaults';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  filterBySearchWords,
  itemPreviewSearchTerms,
} from '@helpers/item/item-search';
import type { ItemId } from '@interfaces';

const ore = ensureItem({
  id: 'ore' as ItemId,
  name: 'Copper Ore',
  description: 'Shiny.',
  rarity: 'Uncommon',
  infusionStats: { ...defaultStats(), Strength: 1 },
});

describe('itemPreviewSearchTerms', () => {
  it('includes name, description, rarity and non-zero stat labels', () => {
    const terms = itemPreviewSearchTerms(itemPreviewDisplay('item', ore));

    expect(terms).toEqual(
      expect.arrayContaining(['Copper Ore', 'Shiny.', 'Uncommon', 'Strength']),
    );
    expect(terms).not.toContain('Intelligence');
  });
});

describe('filterBySearchWords', () => {
  const entries = ['Copper Ore', 'Iron Ore', 'Copper Bar'];
  const filter = (text: string) =>
    filterBySearchWords(entries, text, (entry) => entry);

  it('returns everything for blank input', () => {
    expect(filter('   ')).toEqual(entries);
  });

  it('requires every word, in any order, case-insensitively', () => {
    expect(filter('ORE copper')).toEqual(['Copper Ore']);
  });

  it('matches partial words', () => {
    expect(filter('cop')).toEqual(['Copper Ore', 'Copper Bar']);
  });
});
