import { signal } from '@angular/core';
import {
  SAVEFILE_MIGRATE_ATTEMPTS,
  SAVEFILE_RETRY_DELAY_MS,
} from '@helpers/config';
import { defaultGameState } from '@helpers/defaults';
import { error, info } from '@helpers/engine/logging';
import { notifyError, notifyWarning } from '@helpers/engine/notify';
import { gameloopIsProcessing } from '@helpers/gameloop';
import { migrateGameState } from '@helpers/migrate';
import { savefileBackupStore } from '@helpers/savefile/savefile-backup-storage';
import { savefileValidationErrors } from '@helpers/savefile/savefile-validate';
import {
  gamestate,
  gameStateLoadError,
  isGameStateReady,
  saveGameState,
  setGameState,
  setGameStateSavingBlocked,
} from '@helpers/state-game';
import type {
  GameState,
  SavefileBackupReason,
  SavefileLoadFailureReason,
  SavefileLoadStatus,
} from '@interfaces';
import { delay } from 'es-toolkit';

export const savefileLoadStatus = signal<SavefileLoadStatus>({
  state: 'pending',
});

const FAILURE_MESSAGES: Record<SavefileLoadFailureReason, string> = {
  storage: 'Your savefile could not be read from storage.',
  invalid: 'Your savefile appears to be corrupt.',
  migration: 'Your savefile could not be updated to this version.',
};

export function savefileFailureMessage(
  reason: SavefileLoadFailureReason,
): string {
  return FAILURE_MESSAGES[reason];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// A tick in flight reads its own snapshot and commits it at the end, which would clobber the migrated state.
async function waitForGameloopIdle(): Promise<void> {
  while (gameloopIsProcessing()) {
    await delay(SAVEFILE_RETRY_DELAY_MS);
  }
}

// Leaves saves blocked either way; the caller commits once it's safe to overwrite the stored copy.
export async function savefileMigrateWithRetry(
  state: GameState,
): Promise<string[]> {
  setGameStateSavingBlocked(true);
  const failures: string[] = [];

  for (let attempt = 1; attempt <= SAVEFILE_MIGRATE_ATTEMPTS; attempt++) {
    try {
      setGameState(structuredClone(state), false);
      migrateGameState();
      return [];
    } catch (e) {
      error('Savefile:Migrate', `Migration attempt ${attempt} failed.`, e);
      failures.push(`Attempt ${attempt}: ${errorMessage(e)}`);
      if (attempt < SAVEFILE_MIGRATE_ATTEMPTS) {
        await delay(SAVEFILE_RETRY_DELAY_MS);
      }
    }
  }

  return failures;
}

function savefileCommit(): void {
  setGameStateSavingBlocked(false);
  saveGameState();
  savefileLoadStatus.set({ state: 'ok' });
}

function savefileLoadFail(
  reason: SavefileLoadFailureReason,
  details: string[],
  data?: unknown,
): void {
  setGameStateSavingBlocked(true);
  setGameState(defaultGameState(), false);
  savefileLoadStatus.set({ state: 'failed', reason, details, data });

  error('Savefile:Load', savefileFailureMessage(reason), details);
  notifyError(
    `${savefileFailureMessage(reason)} It has not been overwritten - open Settings > Savefile to recover a backup.`,
  );
}

async function savefileLoadStoredState(raw: unknown): Promise<void> {
  const problems = savefileValidationErrors(raw);
  if (problems.length > 0) {
    savefileLoadFail('invalid', problems, raw);
    return;
  }

  // The stored copy is still the pre-migration one here, so this is the last chance to keep it.
  const backedUp = await savefileBackupStore(raw, 'load');
  if (!backedUp) {
    notifyWarning(
      'Could not back up your savefile before loading it. If this keeps happening, reset unreadable backups in Settings > Savefile.',
    );
  }

  const failures = await savefileMigrateWithRetry(raw as GameState);
  if (failures.length > 0) {
    savefileLoadFail('migration', failures, raw);
    return;
  }

  info('Savefile:Load', 'Savefile loaded.');
  savefileCommit();
}

export async function savefileLoad(): Promise<void> {
  const loadError = gameStateLoadError();
  if (loadError) {
    savefileLoadFail('storage', [errorMessage(loadError)]);
    return;
  }

  const raw: unknown = gamestate();
  try {
    await savefileLoadStoredState(raw);
  } catch (e) {
    savefileLoadFail('migration', [errorMessage(e)], raw);
  }
}

let isReplacing = false;

// The current save is only backed up after the replacement migrates, so restoring the oldest backup can't evict it first.
async function savefileReplaceIdle(
  next: GameState,
  reason: SavefileBackupReason,
): Promise<string[]> {
  const previousStatus = savefileLoadStatus();
  const previous = gamestate();

  const rollback = (failures: string[]): string[] => {
    setGameState(previous, false);
    setGameStateSavingBlocked(previousStatus.state !== 'ok');
    return failures;
  };

  const failures = await savefileMigrateWithRetry(next);
  if (failures.length > 0) return rollback(failures);

  if (previousStatus.state === 'ok') {
    const backedUp = await savefileBackupStore(previous, reason);
    if (!backedUp) {
      return rollback([
        'Could not back up your current savefile, so it was kept. If backups are unreadable, reset them in Settings > Savefile.',
      ]);
    }
  }

  savefileCommit();
  return [];
}

export async function savefileReplace(
  next: GameState,
  reason: SavefileBackupReason,
): Promise<string[]> {
  if (isReplacing) return ['Another savefile operation is still running.'];

  isReplacing = true;
  const wasReady = isGameStateReady();
  isGameStateReady.set(false);

  try {
    await waitForGameloopIdle();
    return await savefileReplaceIdle(next, reason);
  } finally {
    isGameStateReady.set(wasReady);
    isReplacing = false;
  }
}

export function savefileMarkFresh(): void {
  setGameStateSavingBlocked(false);
  savefileLoadStatus.set({ state: 'ok' });
}
