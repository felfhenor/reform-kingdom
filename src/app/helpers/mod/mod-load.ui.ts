import { error } from '@helpers/engine/logging';
import { modBundleParse } from '@helpers/mod/mod-bundle';
import { modsDiskList, modsDiskRead } from '@helpers/mod/mod-disk';
import { allMaps, baseTilesetGet } from '@helpers/maps';
import { modBundleUrls, modsDedupe } from '@helpers/mod/mod-registry';
import { modSprites } from '@helpers/mod/mod-sprites';
import { modsStoreList, modsStoreRead } from '@helpers/mod/mod-store';
import { modZipFiles } from '@helpers/mod/mod-zip';
import type {
  ModBundleParseIO,
  ModFile,
  ModInstalled,
  ModSource,
  TiledMap,
} from '@interfaces';

async function modParseIO(): Promise<ModBundleParseIO> {
  const yaml = await import('js-yaml');

  return {
    toUrl: (file) =>
      URL.createObjectURL(new Blob([file.data], { type: 'image/png' })),
    parseYaml: (text) => yaml.load(text),
    baseTileset: baseTilesetGet,
  };
}

export async function modLoadFiles(
  source: ModSource,
  key: string,
  files: ModFile[],
  modioId?: number,
): Promise<ModInstalled> {
  const { bundle, errors } = modBundleParse(files, await modParseIO());
  return { source, key, modioId, manifest: bundle?.manifest, bundle, errors };
}

// A broken mod becomes an error entry, never a rejection, so loading can't hang on it.
async function modLoadSafely(
  source: ModSource,
  key: string,
  read: () => Promise<ModFile[]>,
  modioId?: number,
): Promise<ModInstalled> {
  try {
    return await modLoadFiles(source, key, await read(), modioId);
  } catch (e) {
    error('Mods:Load', `Could not load mod ${key}.`, e);
    return { source, key, modioId, errors: [`Could not read: ${String(e)}`] };
  }
}

async function modDiskFiles(name: string): Promise<ModFile[]> {
  const read = await modsDiskRead(name);
  if (read?.files) return read.files;
  if (read?.zip) return modZipFiles(new Blob([read.zip]));
  return [];
}

async function modStoredFiles(key: string): Promise<ModFile[]> {
  const blob = await modsStoreRead(key);
  return blob ? modZipFiles(blob) : [];
}

async function modsStoredLoad(): Promise<ModInstalled[]> {
  try {
    const entries = await modsStoreList();
    return Promise.all(
      entries.map(async (entry) => ({
        ...(await modLoadSafely(
          entry.modioId ? 'modio' : 'local',
          entry.key,
          () => modStoredFiles(entry.key),
          entry.modioId,
        )),
        logoUrl: entry.logoUrl,
      })),
    );
  } catch (e) {
    error('Mods:Load', 'Could not read stored mods.', e);
    return [];
  }
}

export async function modsLoadAll(): Promise<ModInstalled[]> {
  const folderNames = await modsDiskList();
  const folder = await Promise.all(
    folderNames.map((name) =>
      modLoadSafely('folder', name, () => modDiskFiles(name)),
    ),
  );
  return modsDedupe([...folder, ...(await modsStoredLoad())]);
}

function modsUrlsInUse(): Set<string> {
  return new Set([
    ...[...modSprites().values()].map((sprite) => sprite.url),
    ...[...allMaps().values()].flatMap((map) =>
      (map.data as TiledMap).tilesets.map((tileset) => tileset.image),
    ),
  ]);
}

// The live run may still draw from an old bundle's URLs, so only unused ones are freed.
export function modsRevokeUnused(mods: ModInstalled[]): void {
  const inUse = modsUrlsInUse();
  mods
    .flatMap((mod) => modBundleUrls(mod.bundle))
    .filter((url) => !inUse.has(url))
    .forEach((url) => URL.revokeObjectURL(url));
}
