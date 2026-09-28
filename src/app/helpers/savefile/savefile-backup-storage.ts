import { SAVEFILE_BACKUP_MAX } from '@helpers/config';
import { idbGet, idbIsAvailable, idbPut } from '@helpers/engine/idb';
import { error, info } from '@helpers/engine/logging';
import {
  savefileBackupCreate,
  savefileBackupIsDuplicate,
  savefileBackupIsWellFormed,
  savefileBackupsAdd,
  savefileBackupsNewestFirst,
} from '@helpers/savefile/savefile-backup';
import { savefileIsWorthKeeping } from '@helpers/savefile/savefile-validate';
import type {
  ElectronSavefileBridge,
  SavefileBackup,
  SavefileBackupReadResult,
  SavefileBackupReason,
  SavefileBackupSource,
  WindowWithElectronBridge,
} from '@interfaces';

const BACKUPS_KEY = 'savefileBackups';

function electronBridge(): ElectronSavefileBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as WindowWithElectronBridge).reformElectron;
}

function parseDiskBackup(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// Rejects on a storage error (rather than returning []) so a failed read is never mistaken for "no backups".
async function readBrowserBackups(): Promise<SavefileBackup[]> {
  if (!idbIsAvailable()) return [];

  const stored = await idbGet<unknown[]>(BACKUPS_KEY);
  return (stored ?? []).filter(savefileBackupIsWellFormed);
}

async function readDiskBackups(): Promise<SavefileBackup[]> {
  const bridge = electronBridge();
  if (!bridge) return [];

  const files = await bridge.savefileBackupReadAll();
  return files.map(parseDiskBackup).filter(savefileBackupIsWellFormed);
}

const BACKUP_READERS: Record<
  SavefileBackupSource,
  () => Promise<SavefileBackup[]>
> = {
  browser: readBrowserBackups,
  disk: readDiskBackups,
};

export async function savefileBackupsRead(): Promise<SavefileBackupReadResult> {
  const sources = Object.keys(BACKUP_READERS) as SavefileBackupSource[];
  const results = await Promise.allSettled(
    sources.map((source) => BACKUP_READERS[source]()),
  );

  const backups = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  const unreadableSources = sources.filter((source, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') return false;
    error(
      'Savefile:Backup',
      `Could not read ${source} backups.`,
      result.reason,
    );
    return true;
  });

  return { backups: savefileBackupsNewestFirst(backups), unreadableSources };
}

// Writing an empty `keep` clears the source, which is how an unreadable one gets reset.
export async function savefileBackupsWriteSource(
  source: SavefileBackupSource,
  keep: SavefileBackup[],
  added?: SavefileBackup,
): Promise<void> {
  if (source === 'browser') {
    if (idbIsAvailable()) await idbPut(BACKUPS_KEY, keep);
    return;
  }

  const bridge = electronBridge();
  if (!bridge) return;

  if (added) await bridge.savefileBackupWrite(added.id, JSON.stringify(added));
  await bridge.savefileBackupPrune(keep.map((entry) => entry.id));
}

// Skipping a never-set-up or duplicate save counts as success; only a failed read or write resolves false.
export async function savefileBackupStore(
  state: unknown,
  reason: SavefileBackupReason,
): Promise<boolean> {
  if (!savefileIsWorthKeeping(state)) return true;

  const { backups: existing, unreadableSources } = await savefileBackupsRead();
  if (unreadableSources.length > 0) return false;
  if (savefileBackupIsDuplicate(state, existing)) return true;

  const backup = savefileBackupCreate(state, reason, Date.now());
  const keep = savefileBackupsAdd(existing, backup, SAVEFILE_BACKUP_MAX);

  const results = await Promise.allSettled([
    savefileBackupsWriteSource('browser', keep),
    savefileBackupsWriteSource('disk', keep, backup),
  ]);

  const failures = results.filter((result) => result.status === 'rejected');
  failures.forEach((failure) =>
    error('Savefile:Backup', 'Backup write failed.', failure.reason),
  );

  if (failures.length === 0) {
    info('Savefile:Backup', `Backed up savefile (${reason}) as ${backup.id}.`);
  }

  return failures.length === 0;
}
