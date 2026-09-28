import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { idbGet } from '@helpers/engine/idb';
import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from '@helpers/engine/notify';
import {
  savefileBackupsRead,
  savefileBackupsWriteSource,
} from '@helpers/savefile/savefile-backup-storage';
import {
  savefileLoadStatus,
  savefileReplace,
} from '@helpers/savefile/savefile-load';
import { savefileValidationErrors } from '@helpers/savefile/savefile-validate';
import { GAMESTATE_STORAGE_KEY } from '@helpers/state-game';
import type { GameState, SavefileBackup } from '@interfaces';

function backupLabel(backup: SavefileBackup): string {
  return new Date(backup.createdAt).toLocaleString();
}

export async function savefileRestoreBackup(
  backup: SavefileBackup,
): Promise<boolean> {
  const failures = await savefileReplace(backup.state, 'restore');
  if (failures.length > 0) {
    analyticsSendDesignEvent('Savefile:Restore:Failure');
    notifyError(`Could not restore the backup from ${backupLabel(backup)}.`);
    return false;
  }

  analyticsSendDesignEvent('Savefile:Restore:Success');
  notifySuccess(`Restored the backup from ${backupLabel(backup)}.`);
  return true;
}

// A read error may have been transient; recovering would then overwrite a save that is actually fine.
async function storedSavefileReadableAgain(): Promise<boolean> {
  const status = savefileLoadStatus();
  if (status.state !== 'failed' || status.reason !== 'storage') return false;

  try {
    await idbGet(GAMESTATE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function recoverFailureMessage(backupCount: number, hasUnreadable: boolean) {
  if (backupCount > 0) return 'None of your backups could be loaded.';
  return hasUnreadable
    ? 'Backups could not be read from storage.'
    : 'No backups were found to recover from.';
}

// Newest first, skipping backups that fail, so one bad backup can't block an older good one.
export async function savefileRecover(): Promise<boolean> {
  if (await storedSavefileReadableAgain()) {
    notifyWarning(
      'Your savefile can be read again - reload the game to load it instead of recovering a backup.',
    );
    return false;
  }

  const { backups, unreadableSources } = await savefileBackupsRead();

  for (const backup of backups) {
    const failures = await savefileReplace(backup.state, 'restore');
    if (failures.length === 0) {
      analyticsSendDesignEvent('Savefile:Recover:Success');
      notifySuccess(`Recovered your savefile from ${backupLabel(backup)}.`);
      return true;
    }
  }

  analyticsSendDesignEvent('Savefile:Recover:Failure');
  notifyError(
    recoverFailureMessage(backups.length, unreadableSources.length > 0),
  );
  return false;
}

// Only the unreadable sources are cleared, so backups that can still be read survive.
export async function savefileBackupsResetUnreadable(): Promise<boolean> {
  const { unreadableSources } = await savefileBackupsRead();
  const results = await Promise.allSettled(
    unreadableSources.map((source) => savefileBackupsWriteSource(source, [])),
  );

  if (results.some((result) => result.status === 'rejected')) {
    analyticsSendDesignEvent('Savefile:ResetBackups:Failure');
    notifyError('Unreadable backups could not be cleared.');
    return false;
  }

  analyticsSendDesignEvent('Savefile:ResetBackups:Success');
  notifySuccess('Cleared unreadable backups. New backups can be made again.');
  return true;
}

function parseSavefileJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export async function savefileImportJson(json: string): Promise<boolean> {
  const state = parseSavefileJson(json);
  const problems = savefileValidationErrors(state);
  if (problems.length > 0) {
    notifyError(`That file is not a usable savefile: ${problems[0]}`);
    return false;
  }

  const failures = await savefileReplace(state as GameState, 'import');
  if (failures.length > 0) {
    notifyError(`Could not import that savefile: ${failures.at(-1)}`);
    return false;
  }

  notifySuccess('Successfully imported savefile!');
  return true;
}

export function savefileExportDownload(data: unknown, fileName: string): void {
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', fileName);
  downloadAnchorNode.click();
}
