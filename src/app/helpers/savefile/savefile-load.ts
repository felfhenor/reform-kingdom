import { i18nLabels, t } from '@helpers/i18n/i18n';
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
import {
  modsLiveCapture,
  modsLiveRestore,
  modsReset,
} from '@helpers/mod/mod-apply';
import { savefileBackupStore } from '@helpers/savefile/savefile-backup-storage';
import { savefileModsPrepare } from '@helpers/savefile/savefile-mods';
import {
  savefileIsWorthKeeping,
  savefileValidationErrors,
} from '@helpers/savefile/savefile-validate';
import {
  gamestate,
  gameStateLoadAlternate,
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

const FAILURE_MESSAGES: Record<SavefileLoadFailureReason, string> = i18nLabels(
  'savefileLoad.failure',
  ['storage', 'invalid', 'migration', 'mods'],
);

export function savefileFailureMessage(
  reason: SavefileLoadFailureReason,
): string {
  return FAILURE_MESSAGES[reason];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// A tick in flight reads its own snapshot and commits it at the end, which would clobber the migrated state.
export async function waitForGameloopIdle(): Promise<void> {
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
  modsReset();
  setGameState(defaultGameState(), false);
  savefileLoadStatus.set({ state: 'failed', reason, details, data });

  error('Savefile:Load', savefileFailureMessage(reason), details);
  notifyError(
    t('savefileLoad.itHasNotBeen', { reason: savefileFailureMessage(reason) }),
  );
}

async function savefileLoadStoredState(raw: unknown): Promise<void> {
  const problems = savefileValidationErrors(raw);
  if (problems.length > 0) {
    savefileLoadFail('invalid', problems, raw);
    return;
  }

  // The stored copy is still the pre-migration one here, so this is the last chance to keep it.
  // The desktop build's other stored copy is overwritten by the same first save, so it's kept too.
  const alternate = gameStateLoadAlternate();
  const toBackUp = savefileIsWorthKeeping(alternate) ? [raw, alternate] : [raw];
  let backedUp = true;
  for (const state of toBackUp) {
    backedUp = (await savefileBackupStore(state, 'load')) && backedUp;
  }
  if (!backedUp) {
    notifyWarning(t('savefileLoad.couldNotBackUp'));
  }

  const prepared = savefileModsPrepare(raw as GameState);
  if (prepared.errors.length > 0) {
    savefileLoadFail('mods', prepared.errors, raw);
    return;
  }

  const failures = await savefileMigrateWithRetry(prepared.state);
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

// No `reason` skips the backup, for swaps that only reload the same mods into the same run.
// The current save is only backed up after the replacement migrates, so restoring the oldest backup can't evict it first.
async function savefileReplaceIdle(
  next: GameState,
  reason?: SavefileBackupReason,
): Promise<string[]> {
  const previousStatus = savefileLoadStatus();
  const previous = gamestate();
  const previousMods = modsLiveCapture();

  const rollback = (failures: string[]): string[] => {
    modsLiveRestore(previousMods);
    setGameState(previous, false);
    setGameStateSavingBlocked(previousStatus.state !== 'ok');
    return failures;
  };

  const prepared = savefileModsPrepare(next);
  if (prepared.errors.length > 0) return rollback(prepared.errors);

  const failures = await savefileMigrateWithRetry(prepared.state);
  if (failures.length > 0) return rollback(failures);

  if (previousStatus.state === 'ok' && reason) {
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
  reason?: SavefileBackupReason,
): Promise<string[]> {
  if (isReplacing) return [t('savefileLoad.anotherSavefileOperationIs')];

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
