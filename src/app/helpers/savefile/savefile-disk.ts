import { error } from '@helpers/engine/logging';
import { savefileIsWorthKeeping } from '@helpers/savefile/savefile-validate';
import type {
  ElectronSavefileStoreBridge,
  GameState,
  SavefileStorage,
  WindowWithElectronSavefileStoreBridge,
} from '@interfaces';

// Partial since a desktop shell older than these handlers can load a newer web build.
export function savefileDiskBridge():
  Partial<ElectronSavefileStoreBridge> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as WindowWithElectronSavefileStoreBridge).reformElectron;
}

// Undefined when there's no desktop copy to read, including when it can't be read.
export async function savefileDiskRead(): Promise<unknown> {
  const read = savefileDiskBridge()?.savefileRead;
  if (!read) return undefined;

  try {
    const json = await read();
    return json === undefined ? undefined : JSON.parse(json);
  } catch (e) {
    error('Savefile:Disk', 'Could not read the savefile from disk.', e);
    return undefined;
  }
}

// Undefined outside the desktop build, where there's no disk copy to keep.
export async function savefileDiskWrite(
  state: GameState,
): Promise<boolean | undefined> {
  const write = savefileDiskBridge()?.savefileWrite;
  if (!write) return undefined;

  try {
    return await write(JSON.stringify(state));
  } catch (e) {
    error('Savefile:Disk', 'Could not write the savefile to disk.', e);
    return false;
  }
}

// Save stamps, not tick counts: a new game or an older restored backup can legitimately have fewer ticks.
export function savefileNewerStorage(
  browser: unknown,
  disk: unknown,
): SavefileStorage {
  if (!savefileIsWorthKeeping(disk)) return 'browser';
  if (!savefileIsWorthKeeping(browser)) return 'disk';

  return (disk.meta.savedAt ?? 0) > (browser.meta.savedAt ?? 0)
    ? 'disk'
    : 'browser';
}
