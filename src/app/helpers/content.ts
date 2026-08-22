import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import {
  ensureContent,
  hasContentInitializer,
} from '@helpers/content-initializers';
import type { ContentType, IsContentItem } from '@interfaces';

const _allIdsByName = signal<Map<string, string>>(new Map());
export const allIdsByName: Signal<Map<string, string>> =
  _allIdsByName.asReadonly();

const _allContentById = signal<Map<string, IsContentItem>>(new Map());
export const allContentById: Signal<Map<string, Readonly<IsContentItem>>> =
  _allContentById.asReadonly();

export function setAllIdsByName(state: Map<string, string>): void {
  _allIdsByName.set(new Map(state));
}

export function setAllContentById(state: Map<string, IsContentItem>): void {
  _allContentById.set(new Map(state));
}

export function getEntriesByType<T>(type: ContentType): T[] {
  return (
    [...allContentById()]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, entry]) => entry.__type === type)
      .map((e) => e[1]) as T[]
  );
}

// Turns a fetched content bundle (keyed by subtype, e.g. `all.json`) into
// the `allIdsByName`/`allContentById` signals - shared by `ContentService`
// (browser) and the debug-dashboard CLI bootstrap (`scripts/debug/load-compiled-content.ts`)
// so both read content through the exact same accessors below.
export function unfurlContent(
  assets: Record<string, IsContentItem[]>,
  onWarn?: (message: string) => void,
): void {
  const idsByNameAssets: Map<string, string> = allIdsByName();
  const entriesByIdAssets: Map<string, IsContentItem> = allContentById();

  Object.keys(assets).forEach((subtype) => {
    Object.values(assets[subtype]).forEach((entry) => {
      entry.__type = subtype as ContentType;

      if (idsByNameAssets.has(entry.name)) {
        onWarn?.(
          `"${entry.name}/${entry.id}" is a duplicate name to "${idsByNameAssets.get(entry.name)}". Skipping...`,
        );
        return;
      }

      const dupe = entriesByIdAssets.get(entry.id);
      if (dupe) {
        onWarn?.(
          `"${entry.name}/${entry.id}" is a duplicate id to "${dupe.name}/${dupe.id}". Skipping...`,
        );
        return;
      }

      if (!hasContentInitializer(entry)) {
        onWarn?.(`Content type ${entry.__type} has no initializer`);
        return;
      }

      const cleanedEntry = ensureContent(entry);

      idsByNameAssets.set(cleanedEntry.name, cleanedEntry.id);
      entriesByIdAssets.set(cleanedEntry.id, cleanedEntry);
    });
  });

  setAllIdsByName(idsByNameAssets);
  setAllContentById(entriesByIdAssets);
}

export function getEntry<T extends IsContentItem>(
  entryIdOrName: string,
): T | undefined {
  if (!entryIdOrName) return undefined;

  const idHash = allIdsByName();
  const entriesHash = allContentById();

  let ret: T = entriesHash.get(entryIdOrName) as T;

  const nameToId = idHash.get(entryIdOrName);
  if (nameToId) {
    ret = entriesHash.get(nameToId) as T;
  }

  return ret;
}
