import { savefileIsValid } from '@helpers/savefile/savefile-validate';
import type {
  GameState,
  LegacyState,
  SavefileBackup,
  SavefileBackupReason,
} from '@interfaces';
import { partition, sortBy, uniqBy } from 'es-toolkit/compat';

export function savefileBackupCreate(
  state: GameState,
  reason: SavefileBackupReason,
  now: number,
  legacy: LegacyState,
): SavefileBackup {
  return {
    id: `backup-${now}`,
    createdAt: now,
    reason,
    gameId: state.gameId,
    numTicks: state.clock.numTicks,
    state,
    legacy,
  };
}

export function savefileBackupIsPeriodic(
  reason: SavefileBackupReason,
): boolean {
  return reason === 'periodic';
}

// Same kind only, else a safety backup could be skipped for a periodic copy that later rolls out.
export function savefileBackupIsDuplicate(
  state: GameState,
  reason: SavefileBackupReason,
  backups: SavefileBackup[],
): boolean {
  const isPeriodic = savefileBackupIsPeriodic(reason);
  return backups.some(
    (backup) =>
      savefileBackupIsPeriodic(backup.reason) === isPeriodic &&
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

// Capped separately so a long session's periodic backups never roll out the load/import/restore ones.
export function savefileBackupsAdd(
  backups: SavefileBackup[],
  backup: SavefileBackup,
  max: number,
  periodicMax: number,
): SavefileBackup[] {
  const [periodic, safety] = partition(
    savefileBackupsNewestFirst([backup, ...backups]),
    (entry) => savefileBackupIsPeriodic(entry.reason),
  );
  return savefileBackupsNewestFirst([
    ...periodic.slice(0, periodicMax),
    ...safety.slice(0, max),
  ]);
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
