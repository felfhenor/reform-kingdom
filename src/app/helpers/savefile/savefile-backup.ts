import { savefileIsValid } from '@helpers/savefile/savefile-validate';
import type {
  GameState,
  SavefileBackup,
  SavefileBackupReason,
} from '@interfaces';
import { sortBy, uniqBy } from 'es-toolkit/compat';

export function savefileBackupCreate(
  state: GameState,
  reason: SavefileBackupReason,
  now: number,
): SavefileBackup {
  return {
    id: `backup-${now}`,
    createdAt: now,
    reason,
    gameId: state.gameId,
    numTicks: state.clock.numTicks,
    state,
  };
}

// Relaunching without playing would otherwise rotate out older, distinct backups with identical copies.
export function savefileBackupIsDuplicate(
  state: GameState,
  backups: SavefileBackup[],
): boolean {
  return backups.some(
    (backup) =>
      backup.gameId === state.gameId &&
      backup.numTicks === state.clock.numTicks,
  );
}

export function savefileBackupsNewestFirst(
  backups: SavefileBackup[],
): SavefileBackup[] {
  return sortBy(
    uniqBy(backups, (backup) => backup.id),
    (backup) => -backup.createdAt,
  );
}

export function savefileBackupsAdd(
  backups: SavefileBackup[],
  backup: SavefileBackup,
  max: number,
): SavefileBackup[] {
  return savefileBackupsNewestFirst([backup, ...backups]).slice(0, max);
}

export function savefileBackupIsWellFormed(
  value: unknown,
): value is SavefileBackup {
  const backup = value as Partial<SavefileBackup> | undefined;
  return (
    typeof backup?.id === 'string' &&
    typeof backup.createdAt === 'number' &&
    savefileIsValid(backup.state)
  );
}
