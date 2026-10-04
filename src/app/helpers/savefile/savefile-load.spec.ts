import type { GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('es-toolkit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  delay: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/engine/logging');
vi.mock('@helpers/gameloop');
vi.mock('@helpers/migrate');
vi.mock('@helpers/savefile/savefile-backup-storage');

import { defaultGameState } from '@helpers/defaults';
import { gameloopIsProcessing } from '@helpers/gameloop';
import { migrateGameState } from '@helpers/migrate';
import { savefileBackupStore } from '@helpers/savefile/savefile-backup-storage';
import {
  savefileLoad,
  savefileLoadStatus,
  savefileMarkFresh,
  savefileMigrateWithRetry,
  savefileReplace,
} from '@helpers/savefile/savefile-load';
import {
  gamestate,
  gameStateLoadError,
  isGameStateReady,
  saveGameState,
  setGameState,
  setGameStateSavingBlocked,
} from '@helpers/state-game';
import { seedGamestate, storedSave } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';

const untouched = defaultGameState();

function setupState(numTicks = 10): GameState {
  const state = defaultGameState();
  state.meta.isSetup = true;
  state.clock.numTicks = numTicks;
  return state;
}

function current(numTicks = 10): GameState {
  return seedGamestate((state) => {
    state.meta.isSetup = true;
    state.clock.numTicks = numTicks;
  });
}

function wasStored(): boolean {
  return storedSave() !== untouched;
}

function savingIsBlocked(): boolean {
  storedSave.set(untouched);
  saveGameState();
  const blocked = !wasStored();
  storedSave.set(untouched);
  return blocked;
}

function migrationAlwaysThrows(): void {
  vi.mocked(migrateGameState).mockImplementation(() => {
    throw new Error('broken');
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(savefileBackupStore).mockResolvedValue(true);
  setGameStateSavingBlocked(false);
  gameStateLoadError.set(undefined);
  isGameStateReady.set(true);
  storedSave.set(untouched);
  savefileLoadStatus.set({ state: 'pending' });
});

describe('savefileMigrateWithRetry', () => {
  it('leaves saving blocked for the caller to commit', async () => {
    const failures = await savefileMigrateWithRetry(setupState());

    expect(failures).toEqual([]);
    expect(migrateGameState).toHaveBeenCalledTimes(1);
    expect(wasStored()).toBe(false);
    expect(savingIsBlocked()).toBe(true);
  });

  it('retries from a fresh copy after a failed attempt', async () => {
    const original = setupState();
    vi.mocked(migrateGameState).mockImplementationOnce(() => {
      gamestate().clock.numTicks = -1;
      throw new Error('flaky');
    });

    const failures = await savefileMigrateWithRetry(original);

    expect(failures).toEqual([]);
    expect(migrateGameState).toHaveBeenCalledTimes(2);
    expect(gamestate().clock.numTicks).toBe(10);
    expect(original.clock.numTicks).toBe(10);
  });

  it('gives up after three attempts and keeps saving blocked', async () => {
    migrationAlwaysThrows();

    const failures = await savefileMigrateWithRetry(setupState());

    expect(failures).toHaveLength(3);
    expect(failures[0]).toContain('broken');
    expect(wasStored()).toBe(false);
    expect(savingIsBlocked()).toBe(true);
  });
});

describe('savefileLoad', () => {
  it('backs up the stored state before migrating it, then saves the result', async () => {
    const stored = current();

    await savefileLoad();

    expect(savefileBackupStore).toHaveBeenCalledWith(stored, 'load');
    expect(
      vi.mocked(savefileBackupStore).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(migrateGameState).mock.invocationCallOrder[0]);
    expect(savefileLoadStatus()).toEqual({ state: 'ok' });
    expect(storedSave()).toEqual(stored);
    expect(savingIsBlocked()).toBe(false);
  });

  it('still loads, with a warning, when the backup could not be written', async () => {
    current();
    vi.mocked(savefileBackupStore).mockResolvedValueOnce(false);
    const notifications = captureNotifications();

    await savefileLoad();

    expect(notifications.map(({ type }) => type)).toEqual(['warning']);
    expect(savefileLoadStatus()).toEqual({ state: 'ok' });
  });

  it('fails without migrating or saving when the stored state is corrupt', async () => {
    const stored = { meta: {} } as unknown as GameState;
    setGameState(stored, false);
    const notifications = captureNotifications();

    await savefileLoad();

    expect(migrateGameState).not.toHaveBeenCalled();
    expect(wasStored()).toBe(false);
    expect(savingIsBlocked()).toBe(true);
    expect(savefileLoadStatus()).toMatchObject({
      state: 'failed',
      reason: 'invalid',
      data: stored,
    });
    expect(notifications.map(({ type }) => type)).toEqual(['error']);
  });

  it('fails when storage could not be read', async () => {
    gameStateLoadError.set(new Error('disk on fire'));

    await savefileLoad();

    expect(savefileLoadStatus()).toMatchObject({
      state: 'failed',
      reason: 'storage',
      details: ['disk on fire'],
    });
    expect(savingIsBlocked()).toBe(true);
  });

  it('fails rather than staying pending when the backup itself throws', async () => {
    current();
    vi.mocked(savefileBackupStore).mockRejectedValueOnce(new Error('idb gone'));

    await savefileLoad();

    expect(savefileLoadStatus()).toMatchObject({
      state: 'failed',
      reason: 'migration',
      details: ['idb gone'],
    });
    expect(wasStored()).toBe(false);
  });

  it('fails with a fresh, unsaved state when every migration throws', async () => {
    const stored = current();
    migrationAlwaysThrows();

    await savefileLoad();

    expect(savefileLoadStatus()).toMatchObject({
      state: 'failed',
      reason: 'migration',
      data: stored,
    });
    expect(gamestate().meta.isSetup).toBe(false);
    expect(wasStored()).toBe(false);
    expect(savingIsBlocked()).toBe(true);
  });
});

describe('savefileReplace', () => {
  beforeEach(() => savefileLoadStatus.set({ state: 'ok' }));

  it('backs up the current save before replacing it', async () => {
    const previous = current(5);

    const failures = await savefileReplace(setupState(99), 'import');

    expect(failures).toEqual([]);
    expect(savefileBackupStore).toHaveBeenCalledWith(previous, 'import');
    expect(gamestate().clock.numTicks).toBe(99);
    expect(storedSave().clock.numTicks).toBe(99);
  });

  it('keeps the current save when it could not be backed up', async () => {
    const previous = current(5);
    vi.mocked(savefileBackupStore).mockResolvedValueOnce(false);

    const failures = await savefileReplace(setupState(99), 'import');

    expect(failures).toHaveLength(1);
    expect(wasStored()).toBe(false);
    expect(gamestate()).toBe(previous);
    expect(savingIsBlocked()).toBe(false);
  });

  it('only backs up the current save once the replacement has migrated', async () => {
    current(5);
    migrationAlwaysThrows();

    await savefileReplace(setupState(99), 'restore');

    expect(savefileBackupStore).not.toHaveBeenCalled();
  });

  it('rejects a second replace while one is running', async () => {
    current(5);

    const [first, second] = await Promise.all([
      savefileReplace(setupState(99), 'import'),
      savefileReplace(setupState(42), 'import'),
    ]);

    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(gamestate().clock.numTicks).toBe(99);
    expect(isGameStateReady()).toBe(true);
  });

  it('leaves a not-yet-ready game not ready afterward', async () => {
    current(5);
    isGameStateReady.set(false);

    await savefileReplace(setupState(99), 'import');

    expect(isGameStateReady()).toBe(false);
  });

  it('pauses readiness while replacing', async () => {
    current(5);
    let readyWhileMigrating: boolean | undefined;
    vi.mocked(migrateGameState).mockImplementation(
      () => (readyWhileMigrating = isGameStateReady()),
    );

    await savefileReplace(setupState(99), 'import');

    expect(readyWhileMigrating).toBe(false);
    expect(isGameStateReady()).toBe(true);
  });

  it('waits for an in-flight tick before touching state', async () => {
    current(5);
    vi.mocked(gameloopIsProcessing)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);

    await savefileReplace(setupState(99), 'import');

    expect(gameloopIsProcessing).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(gameloopIsProcessing).mock.invocationCallOrder[2],
    ).toBeLessThan(vi.mocked(migrateGameState).mock.invocationCallOrder[0]);
  });

  it('rolls back to the current save when the replacement will not migrate', async () => {
    const previous = current(5);
    migrationAlwaysThrows();

    const failures = await savefileReplace(setupState(99), 'import');

    expect(failures).toHaveLength(3);
    expect(gamestate()).toBe(previous);
    expect(savingIsBlocked()).toBe(false);
    expect(isGameStateReady()).toBe(true);
  });

  describe('from an unloadable save', () => {
    beforeEach(() => {
      seedGamestate();
      setGameStateSavingBlocked(true);
      savefileLoadStatus.set({
        state: 'failed',
        reason: 'invalid',
        details: [],
      });
    });

    it('marks it as recovered once a backup migrates', async () => {
      const failures = await savefileReplace(setupState(99), 'restore');

      expect(failures).toEqual([]);
      expect(savefileBackupStore).not.toHaveBeenCalled();
      expect(savefileLoadStatus()).toEqual({ state: 'ok' });
      expect(storedSave().clock.numTicks).toBe(99);
    });

    it('keeps saving blocked when recovery fails', async () => {
      migrationAlwaysThrows();

      await savefileReplace(setupState(99), 'restore');

      expect(savingIsBlocked()).toBe(true);
      expect(savefileLoadStatus()).toMatchObject({ state: 'failed' });
    });
  });
});

describe('savefileMarkFresh', () => {
  it('unblocks saving and clears a load failure', () => {
    setGameStateSavingBlocked(true);
    savefileLoadStatus.set({
      state: 'failed',
      reason: 'invalid',
      details: [],
    });

    savefileMarkFresh();

    expect(savingIsBlocked()).toBe(false);
    expect(savefileLoadStatus()).toEqual({ state: 'ok' });
  });
});
