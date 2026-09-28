import type {
  ElectronSavefileBridge,
  GameState,
  SavefileBackup,
  WindowWithElectronBridge,
} from '@interfaces';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({ stored: undefined as unknown }));

vi.mock('@helpers/engine/idb', () => ({
  idbIsAvailable: vi.fn(() => true),
  idbGet: vi.fn(() => Promise.resolve(idb.stored)),
  idbPut: vi.fn((_key: string, value: unknown) => {
    idb.stored = value;
    return Promise.resolve();
  }),
}));

vi.mock('@helpers/engine/logging', () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

import { defaultGameState } from '@helpers/defaults';
import { idbGet, idbPut } from '@helpers/engine/idb';
import { savefileBackupCreate } from '@helpers/savefile/savefile-backup';
import {
  savefileBackupsRead,
  savefileBackupsWriteSource,
  savefileBackupStore,
} from '@helpers/savefile/savefile-backup-storage';

function setupState(numTicks: number): GameState {
  const state = defaultGameState();
  state.meta.isSetup = true;
  state.gameId = 'game-1' as GameState['gameId'];
  state.clock.numTicks = numTicks;
  return state;
}

function fakeBridge(files: string[] = []): ElectronSavefileBridge {
  return {
    savefileBackupWrite: vi.fn(() => Promise.resolve()),
    savefileBackupReadAll: vi.fn(() => Promise.resolve(files)),
    savefileBackupPrune: vi.fn(() => Promise.resolve()),
  };
}

function installBridge(bridge?: ElectronSavefileBridge): void {
  (window as WindowWithElectronBridge).reformElectron = bridge;
}

describe('savefile-backup-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.stored = undefined;
    installBridge(undefined);
  });

  afterEach(() => installBridge(undefined));

  it('does not back up a save that was never set up', async () => {
    expect(await savefileBackupStore(defaultGameState(), 'load')).toBe(true);
    expect(idbPut).not.toHaveBeenCalled();
  });

  it('does not back up the same progress twice', async () => {
    await savefileBackupStore(setupState(10), 'load');
    await savefileBackupStore(setupState(10), 'load');

    expect(idbPut).toHaveBeenCalledTimes(1);
  });

  it('caps browser backups at three', async () => {
    for (const ticks of [1, 2, 3, 4]) {
      vi.setSystemTime(ticks * 1000);
      await savefileBackupStore(setupState(ticks), 'load');
    }
    vi.useRealTimers();

    const { backups } = await savefileBackupsRead();
    expect(backups.map((backup) => backup.numTicks)).toEqual([4, 3, 2]);
  });

  it('mirrors each backup to disk and prunes disk to the kept set', async () => {
    const bridge = fakeBridge();
    installBridge(bridge);

    await savefileBackupStore(setupState(10), 'load');

    const [kept] = idb.stored as SavefileBackup[];
    expect(bridge.savefileBackupWrite).toHaveBeenCalledWith(
      kept.id,
      JSON.stringify(kept),
    );
    expect(bridge.savefileBackupPrune).toHaveBeenCalledWith([kept.id]);
  });

  it('reports failure when the disk write fails', async () => {
    const bridge = fakeBridge();
    vi.mocked(bridge.savefileBackupWrite).mockRejectedValueOnce(
      new Error('disk full'),
    );
    installBridge(bridge);

    expect(await savefileBackupStore(setupState(10), 'load')).toBe(false);
  });

  it('still finds disk backups after browser storage was wiped', async () => {
    const onDisk = savefileBackupCreate(setupState(7), 'load', 500);
    installBridge(fakeBridge([JSON.stringify(onDisk), '{not json']));

    expect(await savefileBackupsRead()).toEqual({
      backups: [onDisk],
      unreadableSources: [],
    });
  });

  it('refuses to write when a backup source could not be read, so the ring is never truncated', async () => {
    await savefileBackupStore(setupState(1), 'load');
    vi.mocked(idbGet).mockRejectedValueOnce(new Error('read failed'));

    expect(await savefileBackupStore(setupState(2), 'load')).toBe(false);
    expect(idbPut).toHaveBeenCalledTimes(1);
  });

  it('flags a partial read when the disk cannot be read', async () => {
    const bridge = fakeBridge();
    vi.mocked(bridge.savefileBackupReadAll).mockRejectedValueOnce(
      new Error('EACCES'),
    );
    installBridge(bridge);

    expect((await savefileBackupsRead()).unreadableSources).toEqual(['disk']);
  });

  it('clears the browser source when written with nothing to keep', async () => {
    await savefileBackupStore(setupState(1), 'load');

    await savefileBackupsWriteSource('browser', []);

    expect(idb.stored).toEqual([]);
  });

  it('clears the disk source by pruning every file', async () => {
    const bridge = fakeBridge();
    installBridge(bridge);

    await savefileBackupsWriteSource('disk', []);

    expect(bridge.savefileBackupWrite).not.toHaveBeenCalled();
    expect(bridge.savefileBackupPrune).toHaveBeenCalledWith([]);
  });

  it('can back up again once an unreadable source is cleared', async () => {
    vi.mocked(idbGet).mockRejectedValueOnce(new Error('read failed'));
    expect(await savefileBackupStore(setupState(1), 'load')).toBe(false);

    await savefileBackupsWriteSource('browser', []);

    expect(await savefileBackupStore(setupState(2), 'load')).toBe(true);
  });
});
