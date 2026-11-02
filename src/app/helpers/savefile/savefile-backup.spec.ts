import { defaultGameState } from '@helpers/defaults';
import { defaultLegacy } from '@helpers/legacy/legacy';
import {
  savefileBackupCreate,
  savefileBackupIsDuplicate,
  savefileBackupIsWellFormed,
  savefileBackupsAdd,
  savefileBackupsNewestFirst,
} from '@helpers/savefile/savefile-backup';
import type { GameState } from '@interfaces';
import { omit } from 'es-toolkit';
import { describe, expect, it } from 'vitest';

function stateAtTick(numTicks: number, gameId = 'game-1'): GameState {
  const state = defaultGameState();
  state.gameId = gameId as GameState['gameId'];
  state.clock.numTicks = numTicks;
  return state;
}

describe('savefileBackupCreate', () => {
  it('records identity and progress alongside the state', () => {
    const backup = savefileBackupCreate(
      stateAtTick(50),
      'load',
      1000,
      defaultLegacy(),
    );

    expect(backup).toMatchObject({
      id: 'backup-1000',
      createdAt: 1000,
      reason: 'load',
      gameId: 'game-1',
      numTicks: 50,
      legacy: defaultLegacy(),
    });
  });
});

describe('savefileBackupIsDuplicate', () => {
  const existing = [
    savefileBackupCreate(stateAtTick(50), 'load', 1000, defaultLegacy()),
  ];

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
      savefileBackupCreate(stateAtTick(at), 'load', at, defaultLegacy()),
    );
    const added = savefileBackupsAdd(
      backups,
      savefileBackupCreate(stateAtTick(4000), 'import', 4000, defaultLegacy()),
      3,
    );

    expect(added.map((backup) => backup.createdAt)).toEqual([4000, 3000, 2000]);
  });
});

describe('savefileBackupsNewestFirst', () => {
  it('drops copies of the same backup found in both browser and disk storage', () => {
    const backup = savefileBackupCreate(
      stateAtTick(1),
      'load',
      1000,
      defaultLegacy(),
    );
    const older = savefileBackupCreate(
      stateAtTick(0),
      'load',
      500,
      defaultLegacy(),
    );

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
        savefileBackupCreate(stateAtTick(1), 'load', 1000, defaultLegacy()),
      ),
    ).toBe(true);
  });

  it('accepts a backup made before Legacy was backed up', () => {
    const backup = savefileBackupCreate(
      stateAtTick(1),
      'load',
      1000,
      defaultLegacy(),
    );
    expect(savefileBackupIsWellFormed(omit(backup, ['legacy']))).toBe(true);
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
