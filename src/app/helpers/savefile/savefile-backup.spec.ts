import { defaultGameState } from '@helpers/defaults';
import {
  savefileBackupCreate,
  savefileBackupIsDuplicate,
  savefileBackupIsWellFormed,
  savefileBackupsAdd,
  savefileBackupsNewestFirst,
} from '@helpers/savefile/savefile-backup';
import type { GameState } from '@interfaces';
import { describe, expect, it } from 'vitest';

function stateAtTick(numTicks: number, gameId = 'game-1'): GameState {
  const state = defaultGameState();
  state.gameId = gameId as GameState['gameId'];
  state.clock.numTicks = numTicks;
  return state;
}

describe('savefileBackupCreate', () => {
  it('records identity and progress alongside the state', () => {
    const backup = savefileBackupCreate(stateAtTick(50), 'load', 1000);

    expect(backup).toMatchObject({
      id: 'backup-1000',
      createdAt: 1000,
      reason: 'load',
      gameId: 'game-1',
      numTicks: 50,
    });
  });
});

describe('savefileBackupIsDuplicate', () => {
  const existing = [savefileBackupCreate(stateAtTick(50), 'load', 1000)];

  it('matches the same game at the same tick', () => {
    expect(savefileBackupIsDuplicate(stateAtTick(50), existing)).toBe(true);
  });

  it('does not match later progress in the same game', () => {
    expect(savefileBackupIsDuplicate(stateAtTick(51), existing)).toBe(false);
  });

  it('does not match a different game at the same tick', () => {
    expect(savefileBackupIsDuplicate(stateAtTick(50, 'game-2'), existing)).toBe(
      false,
    );
  });
});

describe('savefileBackupsAdd', () => {
  it('keeps only the newest entries up to the cap', () => {
    const backups = [1000, 2000, 3000].map((at) =>
      savefileBackupCreate(stateAtTick(at), 'load', at),
    );
    const added = savefileBackupsAdd(
      backups,
      savefileBackupCreate(stateAtTick(4000), 'import', 4000),
      3,
    );

    expect(added.map((backup) => backup.createdAt)).toEqual([4000, 3000, 2000]);
  });
});

describe('savefileBackupsNewestFirst', () => {
  it('drops copies of the same backup found in both browser and disk storage', () => {
    const backup = savefileBackupCreate(stateAtTick(1), 'load', 1000);
    const older = savefileBackupCreate(stateAtTick(0), 'load', 500);

    expect(savefileBackupsNewestFirst([older, backup, { ...backup }])).toEqual([
      backup,
      older,
    ]);
  });
});

describe('savefileBackupIsWellFormed', () => {
  it('accepts a created backup', () => {
    expect(
      savefileBackupIsWellFormed(
        savefileBackupCreate(stateAtTick(1), 'load', 1000),
      ),
    ).toBe(true);
  });

  it('rejects a backup whose state is corrupt', () => {
    expect(
      savefileBackupIsWellFormed({ id: 'backup-1', createdAt: 1, state: {} }),
    ).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(savefileBackupIsWellFormed(undefined)).toBe(false);
  });
});
