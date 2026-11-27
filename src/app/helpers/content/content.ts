import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import {
  ensureContent,
  hasContentInitializer,
} from '@helpers/content/content-initializers';
import type { ContentType, IsContentItem } from '@interfaces';
import { isArray, mergeWith } from 'es-toolkit/compat';

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

// Keyed on the map itself: content is only ever replaced wholesale, so a new map means a stale index.
const entriesByTypeCache = new WeakMap<
  Map<string, IsContentItem>,
  Map<ContentType, IsContentItem[]>
>();

function entriesByTypeIndex(): Map<ContentType, IsContentItem[]> {
  const all = allContentById();
  let index = entriesByTypeCache.get(all);
  if (index) return index;

  index = new Map();
  all.forEach((entry) => {
    const list = index!.get(entry.__type);
    if (list) list.push(entry);
    else index!.set(entry.__type, [entry]);
  });
  entriesByTypeCache.set(all, index);
  return index;
}

// Called many times per tick, so it reads an index instead of scanning all content. Copied so callers can't mutate the index.
export function getEntriesByType<T>(type: ContentType): T[] {
  return [...(entriesByTypeIndex().get(type) ?? [])] as T[];
}

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

let baseIdsByName = new Map<string, string>();
let baseContentById = new Map<string, IsContentItem>();

export function contentSnapshotBase(): void {
  baseIdsByName = new Map(allIdsByName());
  baseContentById = new Map(allContentById());
}

export function contentRestoreBase(): void {
  setAllIdsByName(baseIdsByName);
  setAllContentById(baseContentById);
}

function contentPatchMerge(base: IsContentItem, patch: object): IsContentItem {
  const merged = mergeWith(structuredClone(base), patch, (_, src) =>
    isArray(src) ? src : undefined,
  );
  return ensureContent({ ...merged, __type: base.__type });
}

// Deep-merges onto the entry with the same id (arrays replace); returns an error instead of throwing.
export function contentPatch(
  patch: IsContentItem,
  type: ContentType,
): string | undefined {
  const base = allContentById().get(patch.id);
  if (!base) return `Patch "${patch.id}" matches no existing entry.`;
  if (base.__type !== type) {
    return `Patch "${patch.id}" is in ${type}/ but patches a ${base.__type}.`;
  }

  const patched = contentPatchMerge(base, patch);
  const idsByName = new Map(allIdsByName());
  const nameOwner = idsByName.get(patched.name);
  if (nameOwner && nameOwner !== patched.id) {
    return `Patch "${patch.id}" renames to "${patched.name}", which is taken.`;
  }

  idsByName.delete(base.name);
  idsByName.set(patched.name, patched.id);
  const contentById = new Map(allContentById());
  contentById.set(patched.id, patched);

  setAllIdsByName(idsByName);
  setAllContentById(contentById);
  return undefined;
}

// For migrations: a saved id that no longer resolves was renamed or removed from gamedata.
export function contentExists(id: string): boolean {
  return !!getEntry(id);
}
