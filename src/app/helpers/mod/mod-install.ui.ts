import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { modLoadFiles, modsRevokeUnused } from '@helpers/mod/mod-load.ui';
import {
  modRefOf,
  modsRunOutdated,
  modUsableBundle,
} from '@helpers/mod/mod-registry';
import { modsStorePut, modsStoreRemove } from '@helpers/mod/mod-store';
import { modZipFiles } from '@helpers/mod/mod-zip';
import {
  savefileLoadStatus,
  savefileReplace,
} from '@helpers/savefile/savefile-load';
import { gamestate } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';
import type { ModInstalled } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Validated before it's stored, so a broken zip never becomes an installed mod.
export async function modsImportZip(
  data: Blob,
  modioId?: number,
  logoUrl?: string,
): Promise<string[]> {
  try {
    const files = await modZipFiles(data);
    const parsed = await modLoadFiles('local', 'import', files, modioId);
    modsRevokeUnused([parsed]);
    if (!parsed.manifest) return parsed.errors;
    if (parsed.errors.length > 0) return parsed.errors;

    const key = modioId === undefined ? parsed.manifest.id : `modio-${modioId}`;
    await modsStorePut({ key, modioId, logoUrl }, data);
    analyticsSendDesignEvent('Mods:Import');
    return [];
  } catch (e) {
    return [`Could not read that zip: ${String(e)}`];
  }
}

export async function modsRemoveStored(mod: ModInstalled): Promise<void> {
  await modsStoreRemove(mod.key);
  if (mod.manifest) modsSetEnabled(mod.manifest.id, false);
}

// An enabled id with no installed mod would otherwise block every new game with no row to untick.
export function modsPruneEnabled(installedIds: string[]): void {
  const enabled = getOption('modsEnabled');
  const kept = enabled.filter((id) => installedIds.includes(id));
  if (kept.length !== enabled.length) setOption('modsEnabled', kept);
}

export function modsSetEnabled(id: string, enabled: boolean): void {
  const others = getOption('modsEnabled').filter((other) => other !== id);
  setOption('modsEnabled', enabled ? [...others, id] : others);
}

export function modsReorderEnabled(fromIndex: number, toIndex: number): void {
  const list = [...getOption('modsEnabled')];
  const target = clamp(toIndex, 0, list.length - 1);
  if (fromIndex < 0 || fromIndex >= list.length || fromIndex === target) return;

  const [moved] = list.splice(fromIndex, 1);
  list.splice(target, 0, moved);
  setOption('modsEnabled', list);
}

// Mods only apply when a save loads, so a newer copy of a run's mod needs a save swap to show up.
export async function modsRefreshRun(): Promise<string[]> {
  const meta = gamestate().meta;
  const isLive = savefileLoadStatus().state === 'ok' && meta.isSetup;
  if (!isLive || !modsRunOutdated(meta.mods)) return [];

  return savefileReplace(structuredClone(gamestate()), 'mods');
}

// A full save swap, so the add gets the idle wait, a backup and a rollback.
export async function modsAddToRun(id: string): Promise<string[]> {
  const bundle = modUsableBundle(id);
  if (!bundle) return ['That mod is not installed or has errors.'];

  const state = gamestate();
  const next = structuredClone(state);
  next.meta.mods = [...state.meta.mods, modRefOf(bundle)];

  return savefileReplace(next, 'mods');
}
