import type { GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const live = vi.hoisted(() => ({
  state: undefined as unknown,
  savingBlocked: false,
  loadError: undefined as unknown,
  ready: true,
}));

vi.mock('es-toolkit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  delay: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/migrate', () => ({
  migrateGameState: vi.fn(),
}));

vi.mock('@helpers/gameloop', () => ({
  gameloopIsProcessing: vi.fn(() => false),
}));

vi.mock('@helpers/savefile/savefile-backup-storage', () => ({
  savefileBackupStore: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@helpers/engine/notify', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock('@helpers/engine/logging', () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@helpers/state-game', () => {
  const isGameStateReady = () => live.ready;
  isGameStateReady.set = (ready: boolean) => (live.ready = ready);

  return {
    gamestate: () => live.state,
    gameStateLoadError: () => live.loadError,
    isGameStateReady,
    saveGameState: vi.fn(),
    setGameState: vi.fn((state: unknown) => (live.state = state)),
    setGameStateSavingBlocked: vi.fn(
      (blocked: boolean) => (live.savingBlocked = blocked),
    ),
  };
});

import { defaultGameState } from '@helpers/defaults';
import { notifyError, notifyWarning } from '@helpers/engine/notify';
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
import { saveGameState } from '@helpers/state-game';

function setupState(numTicks = 10): GameState {
  const state = defaultGameState();
  state.meta.isSetup = true;
  state.clock.numTicks = numTicks;
  return state;
}

function migrationAlwaysThrows(): void {
  vi.mocked(migrateGameState).mockImplementation(() => {
    throw new Error('broken');
  });
}

describe('savefile-load', () => {
  beforeEach(() => {
    vi.mocked(migrateGameState).mockReset();
    vi.clearAllMocks();
    live.state = undefined;
    live.savingBlocked = false;
    live.loadError = undefined;
    live.ready = true;
    savefileLoadStatus.set({ state: 'pending' });
  });

  describe('savefileMigrateWithRetry', () => {
    it('leaves saving blocked for the caller to commit', async () => {
      const failures = await savefileMigrateWithRetry(setupState());

      expect(failures).toEqual([]);
      expect(migrateGameState).toHaveBeenCalledTimes(1);
      expect(saveGameState).not.toHaveBeenCalled();
      expect(live.savingBlocked).toBe(true);
    });

    it('retries from a fresh copy after a failed attempt', async () => {
      const original = setupState();
      vi.mocked(migrateGameState).mockImplementationOnce(() => {
        (live.state as GameState).clock.numTicks = -1;
        throw new Error('flaky');
      });

      const failures = await savefileMigrateWithRetry(original);

      expect(failures).toEqual([]);
      expect(migrateGameState).toHaveBeenCalledTimes(2);
      expect((live.state as GameState).clock.numTicks).toBe(10);
      expect(original.clock.numTicks).toBe(10);
    });

    it('gives up after three attempts and keeps saving blocked', async () => {
      migrationAlwaysThrows();

      const failures = await savefileMigrateWithRetry(setupState());

      expect(failures).toHaveLength(3);
      expect(failures[0]).toContain('broken');
      expect(saveGameState).not.toHaveBeenCalled();
      expect(live.savingBlocked).toBe(true);
    });
  });

  describe('savefileLoad', () => {
    it('backs up the stored state before migrating it', async () => {
      const stored = setupState();
      live.state = stored;

      await savefileLoad();

      expect(savefileBackupStore).toHaveBeenCalledWith(stored, 'load');
      expect(
        vi.mocked(savefileBackupStore).mock.invocationCallOrder[0],
      ).toBeLessThan(vi.mocked(migrateGameState).mock.invocationCallOrder[0]);
      expect(savefileLoadStatus()).toEqual({ state: 'ok' });
      expect(saveGameState).toHaveBeenCalledTimes(1);
      expect(live.savingBlocked).toBe(false);
    });

    it('still loads, with a warning, when the backup could not be written', async () => {
      live.state = setupState();
      vi.mocked(savefileBackupStore).mockResolvedValueOnce(false);

      await savefileLoad();

      expect(notifyWarning).toHaveBeenCalled();
      expect(savefileLoadStatus()).toEqual({ state: 'ok' });
    });

    it('fails without migrating or saving when the stored state is corrupt', async () => {
      const stored = { meta: {} };
      live.state = stored;

      await savefileLoad();

      expect(migrateGameState).not.toHaveBeenCalled();
      expect(saveGameState).not.toHaveBeenCalled();
      expect(live.savingBlocked).toBe(true);
      expect(savefileLoadStatus()).toMatchObject({
        state: 'failed',
        reason: 'invalid',
        data: stored,
      });
      expect(notifyError).toHaveBeenCalled();
    });

    it('fails when storage could not be read', async () => {
      live.loadError = new Error('disk on fire');

      await savefileLoad();

      expect(savefileLoadStatus()).toMatchObject({
        state: 'failed',
        reason: 'storage',
        details: ['disk on fire'],
      });
      expect(live.savingBlocked).toBe(true);
    });

    it('fails with a fresh, unsaved state when every migration throws', async () => {
      const stored = setupState();
      live.state = stored;
      migrationAlwaysThrows();

      await savefileLoad();

      expect(savefileLoadStatus()).toMatchObject({
        state: 'failed',
        reason: 'migration',
        data: stored,
      });
      expect((live.state as GameState).meta.isSetup).toBe(false);
      expect(live.savingBlocked).toBe(true);
    });
  });

  describe('savefileReplace', () => {
    it('backs up the current save before replacing it', async () => {
      const current = setupState(5);
      live.state = current;
      savefileLoadStatus.set({ state: 'ok' });

      const failures = await savefileReplace(setupState(99), 'import');

      expect(failures).toEqual([]);
      expect(savefileBackupStore).toHaveBeenCalledWith(current, 'import');
      expect((live.state as GameState).clock.numTicks).toBe(99);
    });

    it('keeps the current save when it could not be backed up', async () => {
      const current = setupState(5);
      live.state = current;
      savefileLoadStatus.set({ state: 'ok' });
      vi.mocked(savefileBackupStore).mockResolvedValueOnce(false);

      const failures = await savefileReplace(setupState(99), 'import');

      expect(failures).toHaveLength(1);
      expect(saveGameState).not.toHaveBeenCalled();
      expect(live.state).toBe(current);
      expect(live.savingBlocked).toBe(false);
    });

    it('only backs up the current save once the replacement has migrated', async () => {
      live.state = setupState(5);
      savefileLoadStatus.set({ state: 'ok' });
      migrationAlwaysThrows();

      await savefileReplace(setupState(99), 'restore');

      expect(savefileBackupStore).not.toHaveBeenCalled();
    });

    it('rejects a second replace while one is running', async () => {
      live.state = setupState(5);
      savefileLoadStatus.set({ state: 'ok' });

      const [first, second] = await Promise.all([
        savefileReplace(setupState(99), 'import'),
        savefileReplace(setupState(42), 'import'),
      ]);

      expect(first).toEqual([]);
      expect(second).toHaveLength(1);
      expect((live.state as GameState).clock.numTicks).toBe(99);
      expect(live.ready).toBe(true);
    });

    it('waits for an in-flight tick before touching state', async () => {
      live.state = setupState(5);
      savefileLoadStatus.set({ state: 'ok' });
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
      const current = setupState(5);
      live.state = current;
      savefileLoadStatus.set({ state: 'ok' });
      migrationAlwaysThrows();

      const failures = await savefileReplace(setupState(99), 'import');

      expect(failures).toHaveLength(3);
      expect(live.state).toBe(current);
      expect(live.savingBlocked).toBe(false);
      expect(live.ready).toBe(true);
    });

    it('marks an unloadable save as recovered once a backup migrates', async () => {
      live.state = defaultGameState();
      savefileLoadStatus.set({
        state: 'failed',
        reason: 'invalid',
        details: [],
      });

      const failures = await savefileReplace(setupState(99), 'restore');

      expect(failures).toEqual([]);
      expect(savefileBackupStore).not.toHaveBeenCalled();
      expect(savefileLoadStatus()).toEqual({ state: 'ok' });
    });

    it('keeps saving blocked when recovery from an unloadable save fails', async () => {
      live.state = defaultGameState();
      savefileLoadStatus.set({
        state: 'failed',
        reason: 'invalid',
        details: [],
      });
      migrationAlwaysThrows();

      await savefileReplace(setupState(99), 'restore');

      expect(live.savingBlocked).toBe(true);
      expect(savefileLoadStatus()).toMatchObject({ state: 'failed' });
    });
  });

  describe('savefileMarkFresh', () => {
    it('unblocks saving and clears a load failure', () => {
      live.savingBlocked = true;
      savefileLoadStatus.set({
        state: 'failed',
        reason: 'invalid',
        details: [],
      });

      savefileMarkFresh();

      expect(live.savingBlocked).toBe(false);
      expect(savefileLoadStatus()).toEqual({ state: 'ok' });
    });
  });
});
