import { error } from '@helpers/engine/logging';
import { savefileIsWorthKeeping } from '@helpers/savefile/savefile-validate';
import type {
  ElectronSavefileStoreBridge,
  GameState,
  LegacyState,
  SavefileDiskRead,
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
async function diskReadJson(
  read: (() => Promise<string | undefined>) | undefined,
  what: string,
): Promise<unknown> {
  if (!read) return undefined;

  try {
    const json = await read();
    return json === undefined ? undefined : JSON.parse(json);
  } catch (e) {
    error('Savefile:Disk', `Could not read the ${what} from disk.`, e);
    return undefined;
  }
}

// Undefined outside the desktop build, where there's no disk copy to keep.
async function diskWriteJson(
  write: ((json: string) => Promise<boolean>) | undefined,
  value: unknown,
  what: string,
): Promise<boolean | undefined> {
  if (!write) return undefined;

  try {
    return await write(JSON.stringify(value));
  } catch (e) {
    error('Savefile:Disk', `Could not write the ${what} to disk.`, e);
    return false;
  }
}

export function savefileDiskRead(): Promise<unknown> {
  return diskReadJson(savefileDiskBridge()?.savefileRead, 'savefile');
}

export function savefileDiskWrite(
  state: GameState,
): Promise<boolean | undefined> {
  return diskWriteJson(savefileDiskBridge()?.savefileWrite, state, 'savefile');
}

export async function savefileDiskLegacyRead(): Promise<SavefileDiskRead> {
  const read = savefileDiskBridge()?.legacyRead;
  if (!read) return { status: 'missing' };

  try {
    const json = await read();
    return json === undefined
      ? { status: 'missing' }
      : { status: 'ok', value: JSON.parse(json) };
  } catch (e) {
    error('Savefile:Disk', 'Could not read the Legacy from disk.', e);
    return { status: 'unreadable' };
  }
}

export function savefileDiskLegacyWrite(
  legacy: LegacyState,
): Promise<boolean | undefined> {
  return diskWriteJson(savefileDiskBridge()?.legacyWrite, legacy, 'Legacy');
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
