import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  filterBySearchWords,
  itemPreviewSearchTerms,
} from '@helpers/item/item-search';
import type { StorageMaterialEntry } from '@interfaces';

export function filterInfusionMaterials(
  entries: StorageMaterialEntry[],
  searchText: string,
): StorageMaterialEntry[] {
  return filterBySearchWords(entries, searchText, (entry) =>
    itemPreviewSearchTerms(itemPreviewDisplay('item', entry.item)).join(' '),
  );
}
