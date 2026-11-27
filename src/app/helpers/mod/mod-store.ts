import { idbDelete, idbGet, idbPut } from '@helpers/engine/idb';
import type { ModStoredEntry } from '@interfaces';

const INDEX_KEY = 'mods:index';
const zipKey = (key: string) => `mods:zip:${key}`;

export async function modsStoreList(): Promise<ModStoredEntry[]> {
  return (await idbGet<ModStoredEntry[]>(INDEX_KEY)) ?? [];
}

export async function modsStoreRead(key: string): Promise<Blob | undefined> {
  return idbGet<Blob>(zipKey(key));
}

export async function modsStorePut(
  entry: ModStoredEntry,
  data: Blob,
): Promise<void> {
  await idbPut(zipKey(entry.key), data);
  const others = (await modsStoreList()).filter((e) => e.key !== entry.key);
  await idbPut(INDEX_KEY, [...others, entry]);
}

export async function modsStoreRemove(key: string): Promise<void> {
  const remaining = (await modsStoreList()).filter((e) => e.key !== key);
  await idbPut(INDEX_KEY, remaining);
  await idbDelete(zipKey(key));
}
