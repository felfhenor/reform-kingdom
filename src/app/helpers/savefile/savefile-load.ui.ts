import { isDemoBuild } from '@helpers/demo/demo';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { idbGet } from '@helpers/engine/idb';
import { error, info } from '@helpers/engine/logging';
import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from '@helpers/engine/notify';
import { legacyLoad } from '@helpers/legacy/legacy';
import {
  legacyMergeFrom,
  legacyShouldSeedDisk,
} from '@helpers/legacy/legacy-merge';
import {
  savefileBackupsRead,
  savefileBackupStore,
  savefileBackupsWriteSource,
} from '@helpers/savefile/savefile-backup-storage';
import {
  savefileLoadStatus,
  savefileReplace,
} from '@helpers/savefile/savefile-load';
import { savefileBundleUnpack } from '@helpers/savefile/savefile-bundle';
import { savefileModsMissing } from '@helpers/savefile/savefile-mods';
import {
  savefileDiskBridge,
  savefileDiskDemoRead,
  savefileDiskLegacyRead,
  savefileDiskLegacyWrite,
} from '@helpers/savefile/savefile-disk';
import {
  savefileIsWorthKeeping,
  savefileValidationErrors,
} from '@helpers/savefile/savefile-validate';
import {
  gamestate,
  GAMESTATE_STORAGE_KEY,
  isGameStateReady,
} from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type {
  GameState,
  LegacyMergeResult,
  SavefileBackup,
  SavefileBundleSections,
} from '@interfaces';

const LEGACY_MERGE_WARNINGS: Partial<Record<LegacyMergeResult, string>> = {
  invalid: "its Legacy couldn't be read.",
  unsaved: "its Legacy couldn't be saved. Free up storage and try again.",
};

// A bad Legacy section never undoes the savefile change; it only warns.
function savefileMergeLegacy(section: unknown, verb: string): void {
  const warning = LEGACY_MERGE_WARNINGS[legacyMergeFrom([section])];
  if (warning) notifyWarning(`Your savefile was ${verb}, but ${warning}`);
}

// Not ready during a replace, and a failed load isn't the player's save, so neither may roll real backups out.
export async function savefileBackupPeriodic(): Promise<void> {
  if (!isGameStateReady() || savefileLoadStatus().state !== 'ok') return;
  await savefileBackupStore(gamestate(), 'periodic');
}

// Refills a lost Legacy from the backups and the desktop copy, then brings the desktop copy up to date; never blocks loading.
export async function savefileLegacySync(): Promise<void> {
  try {
    const { backups } = await savefileBackupsRead();
    const disk = await savefileDiskLegacyRead();
    const result = legacyMergeFrom([
      ...backups.map((backup) => backup.legacy),
      disk.status === 'ok' ? disk.value : undefined,
    ]);
    if (result === 'merged') info('Legacy', 'Restored runs from backups.');
    if (result === 'unsaved') {
      error('Legacy', 'Runs from backups could not be saved.');
    }
    // Desktop players with runs from before the disk copy existed get one on their next launch.
    const stored = legacyLoad();
    if (
      savefileDiskBridge()?.legacyWrite &&
      legacyShouldSeedDisk(result, disk, stored)
    ) {
      await savefileDiskLegacyWrite(stored);
    }
  } catch (e) {
    error('Legacy', 'Could not merge Legacy from backups:', e);
  }
}

function backupLabel(backup: SavefileBackup): string {
  return new Date(backup.createdAt).toLocaleString();
}

export async function savefileRestoreBackup(
  backup: SavefileBackup,
): Promise<boolean> {
  const failures = await savefileReplace(backup.state, 'restore');
  if (failures.length > 0) {
    analyticsSendDesignEvent('Savefile:Restore:Failure');
    notifyError(
      `Could not restore the backup from ${backupLabel(backup)}: ${failures.join(' ')}`,
    );
    return false;
  }

  analyticsSendDesignEvent('Savefile:Restore:Success');
  notifySuccess(`Restored the backup from ${backupLabel(backup)}.`);
  savefileMergeLegacy(backup.legacy, 'restored');
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

function recoverFailureMessage(
  backupCount: number,
  hasUnreadable: boolean,
  lastFailures: string[],
) {
  if (backupCount > 0) {
    return `None of your backups could be loaded. ${lastFailures.join(' ')}`;
  }
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

  let lastFailures: string[] = [];
  for (const backup of backups) {
    const failures = await savefileReplace(backup.state, 'restore');
    lastFailures = failures;
    if (failures.length === 0) {
      analyticsSendDesignEvent('Savefile:Recover:Success');
      notifySuccess(`Recovered your savefile from ${backupLabel(backup)}.`);
      savefileMergeLegacy(backup.legacy, 'recovered');
      return true;
    }
  }

  analyticsSendDesignEvent('Savefile:Recover:Failure');
  notifyError(
    recoverFailureMessage(
      backups.length,
      unreadableSources.length > 0,
      lastFailures,
    ),
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

// A full-game save would lose everything the demo strips the moment it migrates.
function savefileImportProblem(state: unknown): string | undefined {
  const problems = savefileValidationErrors(state);
  if (problems.length > 0) {
    return `That file is not a usable savefile: ${problems[0]}`;
  }
  if (isDemoBuild() && (state as GameState).meta.isDemo !== true) {
    return 'The demo can only import savefiles made in the demo.';
  }
  const missingMods = savefileModsMissing(state as GameState);
  if (missingMods.length > 0) {
    return `That savefile can't be loaded. ${missingMods.join(' ')}`;
  }
  return undefined;
}

async function savefileImportSections({
  savefile: state,
  legacy,
}: SavefileBundleSections): Promise<boolean> {
  const problem = savefileImportProblem(state);
  if (problem) {
    notifyError(problem);
    return false;
  }

  // Once in the full game it's a full-game save, so it can't be taken back into the demo.
  if (!isDemoBuild()) delete (state as GameState).meta.isDemo;

  const failures = await savefileReplace(state as GameState, 'import');
  if (failures.length > 0) {
    notifyError(`Could not import that savefile: ${failures.at(-1)}`);
    return false;
  }

  notifySuccess('Successfully imported savefile!');
  savefileMergeLegacy(legacy, 'imported');
  return true;
}

export function savefileImportJson(json: string): Promise<boolean> {
  return savefileImportSections(savefileBundleUnpack(parseSavefileJson(json)));
}

export async function savefileDemoImportable(): Promise<boolean> {
  if (isDemoBuild()) return false;
  return savefileIsWorthKeeping((await savefileDiskDemoRead())?.savefile);
}

export async function savefileImportDemo(): Promise<boolean> {
  const sections = await savefileDiskDemoRead();
  if (!sections) {
    notifyError('Could not find a savefile from the demo.');
    return false;
  }

  const imported = await savefileImportSections(sections);
  // A carried-over run that later ends shouldn't bring the offer back.
  if (imported) setOption('demoImportDismissed', true);
  analyticsSendDesignEvent(
    `Savefile:ImportDemo:${imported ? 'Success' : 'Failure'}`,
  );
  return imported;
}

export function savefileExportDownload(data: unknown, fileName: string): void {
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', fileName);
  downloadAnchorNode.click();
}
