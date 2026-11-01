import { defaultGameState } from '@helpers/defaults';
import { indexedDbSignal } from '@helpers/engine/signal';
import {
  GAMESTATE_STORAGE_KEY,
  gamestate,
  gameStateLoadAlternate,
  gameStateLoadError,
  hasGameStateLoaded,
  saveGameState,
  setGameState,
  setGameStateSavingBlocked,
} from '@helpers/state-game';
import type {
  GameState,
  WindowWithElectronSavefileStoreBridge,
} from '@interfaces';
import { storedSave } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/logging');

// Captured at import, before anything resets the mock's call history.
const [, , onLoad, onLoadError] = vi
  .mocked(indexedDbSignal)
  .mock.calls.find(([key]) => key === GAMESTATE_STORAGE_KEY)!;

const bridgeWindow = window as WindowWithElectronSavefileStoreBridge;

function savefile(gameId: string, savedAt?: number): GameState {
  const state = defaultGameState();
  state.gameId = gameId as GameState['gameId'];
  state.meta.isSetup = true;
  state.meta.savedAt = savedAt;
  return state;
}

function withDisk(disk: GameState | undefined, writeResult = true) {
  const savefileWrite = vi.fn<(json: string) => Promise<boolean>>(
    async () => writeResult,
  );
  bridgeWindow.reformElectron = {
    savefileWrite,
    savefileRead: async () => (disk ? JSON.stringify(disk) : undefined),
  };
  return savefileWrite;
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

beforeEach(() => {
  setGameStateSavingBlocked(false);
  gameStateLoadError.set(undefined);
  hasGameStateLoaded.set(true);
});

afterEach(() => {
  delete bridgeWindow.reformElectron;
});

describe('saveGameState', () => {
  it('does nothing until the stored copy has loaded', async () => {
    const write = withDisk(undefined);
    storedSave.set(savefile('untouched'));
    hasGameStateLoaded.set(false);

    expect(await saveGameState()).toBe(true);
    expect(storedSave().gameId).toBe('untouched');
    expect(write).not.toHaveBeenCalled();
  });

  it('stamps every save with an increasing save time', async () => {
    withDisk(undefined);
    setGameState(savefile('a'), false);

    await saveGameState();
    const first = storedSave().meta.savedAt!;
    await saveGameState();

    expect(storedSave().meta.savedAt).toBeGreaterThan(first);
  });

  it('writes the same stamped state to disk', async () => {
    const write = withDisk(undefined);
    setGameState(savefile('a'), false);

    await saveGameState();

    expect(JSON.parse(write.mock.calls[0][0])).toEqual(storedSave());
  });

  it('warns about a failed disk write but still counts the browser save', async () => {
    withDisk(undefined, false);
    const notifications = captureNotifications();
    setGameState(savefile('a'), false);

    expect(await saveGameState()).toBe(true);
    expect(notifications.map(({ message }) => message)).toContain(
      'Your game could not be saved to disk.',
    );
  });
});

describe('loading the stored savefile', () => {
  async function load(browser: GameState): Promise<void> {
    hasGameStateLoaded.set(false);
    onLoad?.(browser);
    await settle();
  }

  it('loads the disk copy when it was saved more recently', async () => {
    const browser = savefile('old-game', 100);
    withDisk(savefile('new-game', 200));

    await load(browser);

    expect(gamestate().gameId).toBe('new-game');
    expect(gameStateLoadAlternate()).toEqual(browser);
  });

  it('keeps the browser copy when the disk copy is older', async () => {
    const disk = savefile('a', 100);
    withDisk(disk);

    await load(savefile('a', 200));

    expect(gamestate().meta.savedAt).toBe(200);
    expect(gameStateLoadAlternate()).toEqual(disk);
  });
});

describe('a browser storage read failure', () => {
  async function failLoad(): Promise<void> {
    hasGameStateLoaded.set(false);
    onLoadError?.(new Error('idb broken'));
    await settle();
  }

  it('blocks saving when there is no disk copy to fall back on', async () => {
    withDisk(undefined);

    await failLoad();

    expect(gameStateLoadError()).toBeInstanceOf(Error);
    expect(hasGameStateLoaded()).toBe(true);
  });

  // Runs last: the browser copy stays untouched for the rest of the session.
  it('loads the disk copy and leaves the unreadable browser copy alone', async () => {
    const write = withDisk(savefile('disk-game', 100));
    storedSave.set(savefile('unreadable'));
    const notifications = captureNotifications();

    await failLoad();
    await saveGameState();

    expect(gamestate().gameId).toBe('disk-game');
    expect(gameStateLoadError()).toBeUndefined();
    expect(notifications).toHaveLength(1);
    expect(storedSave().gameId).toBe('unreadable');
    expect(write).toHaveBeenCalled();
  });
});
