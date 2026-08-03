import { getEntry } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import type {
  ItemContent,
  MaterialId,
  StorageMaterialEntry,
} from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

export function getStorageMaterials(): StorageMaterialEntry[] {
  const materials = gamestate().materials;

  const entries = Object.keys(materials)
    .map((id) => {
      const item = getEntry<ItemContent>(id);
      const entry = materials[id as MaterialId];
      const quantity = entry?.quantity ?? 0;
      const foundAt = entry?.foundAt ?? 0;
      return item && quantity > 0 ? { item, quantity, foundAt } : undefined;
    })
    .filter((entry): entry is StorageMaterialEntry => !!entry);

  return orderBy(entries, [(entry) => entry.foundAt], ['desc']);
}

export function filterStorageMaterials(
  entries: StorageMaterialEntry[],
  searchText: string,
): StorageMaterialEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (entry.item.name.toLowerCase().includes(text)) return true;
    if (entry.item.description.toLowerCase().includes(text)) return true;

    return false;
  });
}
