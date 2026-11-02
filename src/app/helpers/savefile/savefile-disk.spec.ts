import { defaultGameState } from '@helpers/defaults';
import { defaultLegacy } from '@helpers/legacy/legacy';
import {
  savefileDiskLegacyRead,
  savefileDiskLegacyWrite,
  savefileDiskRead,
  savefileDiskWrite,
  savefileNewerStorage,
} from '@helpers/savefile/savefile-disk';
import type {
  GameState,
  WindowWithElectronSavefileStoreBridge,
} from '@interfaces';
import { afterEach, describe, expect, it, vi } from 'vitest';

function savefile(gameId: string, savedAt?: number): GameState {
  const state = defaultGameState();
  state.gameId = gameId as GameState['gameId'];
  state.meta.isSetup = true;
  state.meta.savedAt = savedAt;
  return state;
}

describe('savefileNewerStorage', () => {
  it('keeps the browser copy when there is no disk copy', () => {
    expect(savefileNewerStorage(savefile('a', 5), undefined)).toBe('browser');
  });

  it('uses the disk copy when the browser copy is missing or never set up', () => {
    expect(savefileNewerStorage(undefined, savefile('a', 5))).toBe('disk');
    expect(savefileNewerStorage(defaultGameState(), savefile('a', 5))).toBe(
      'disk',
    );
  });

  // A new game, or an older backup restored, has fewer ticks but is still the newer save.
  it('uses whichever copy was saved last, whatever the game', () => {
    expect(savefileNewerStorage(savefile('a', 5), savefile('b', 9))).toBe(
      'disk',
    );
    expect(savefileNewerStorage(savefile('a', 9), savefile('a', 5))).toBe(
      'browser',
    );
  });

  it('keeps the browser copy on a tie or when neither is stamped', () => {
    expect(savefileNewerStorage(savefile('a', 5), savefile('a', 5))).toBe(
      'browser',
    );
    expect(savefileNewerStorage(savefile('a'), savefile('b'))).toBe('browser');
  });

  it('prefers a stamped disk copy over an unstamped browser one', () => {
    expect(savefileNewerStorage(savefile('a'), savefile('a', 1))).toBe('disk');
  });

  it('ignores an invalid disk copy', () => {
    expect(savefileNewerStorage(savefile('a', 5), { nope: true })).toBe(
      'browser',
    );
  });
});

describe('savefile disk bridge', () => {
  const bridgeWindow = window as WindowWithElectronSavefileStoreBridge;

  afterEach(() => {
    delete bridgeWindow.reformElectron;
  });

  it('does nothing outside the desktop build', async () => {
    expect(await savefileDiskRead()).toBeUndefined();
    expect(await savefileDiskWrite(savefile('a', 1))).toBeUndefined();
  });

  it('round-trips the state as JSON', async () => {
    let stored: string | undefined;
    bridgeWindow.reformElectron = {
      savefileWrite: vi.fn(async (json: string) => {
        stored = json;
        return true;
      }),
      savefileRead: vi.fn(async () => stored),
    };

    const state = savefile('a', 3);
    expect(await savefileDiskWrite(state)).toBe(true);
    expect(await savefileDiskRead()).toEqual(state);
  });

  it('treats unparseable disk data as missing', async () => {
    bridgeWindow.reformElectron = { savefileRead: async () => '{oops' };

    expect(await savefileDiskRead()).toBeUndefined();
  });

  it('reports a rejected write as a failure', async () => {
    bridgeWindow.reformElectron = {
      savefileWrite: async () => {
        throw new Error('ipc down');
      },
    };

    expect(await savefileDiskWrite(savefile('a', 1))).toBe(false);
  });

  it('round-trips Legacy as JSON, separately from the savefile', async () => {
    let stored: string | undefined;
    bridgeWindow.reformElectron = {
      legacyWrite: vi.fn(async (json: string) => {
        stored = json;
        return true;
      }),
      legacyRead: vi.fn(async () => stored),
    };

    expect(await savefileDiskLegacyWrite(defaultLegacy())).toBe(true);
    expect(await savefileDiskLegacyRead()).toEqual({
      status: 'ok',
      value: defaultLegacy(),
    });
    expect(await savefileDiskRead()).toBeUndefined();
  });

  it('skips Legacy on a desktop shell older than its handlers', async () => {
    bridgeWindow.reformElectron = { savefileRead: async () => undefined };

    expect(await savefileDiskLegacyWrite(defaultLegacy())).toBeUndefined();
    expect(await savefileDiskLegacyRead()).toEqual({ status: 'missing' });
  });

  it('keeps an unreadable Legacy apart from a missing one', async () => {
    bridgeWindow.reformElectron = {
      legacyRead: async () => {
        throw new Error('EBUSY');
      },
    };
    expect(await savefileDiskLegacyRead()).toEqual({ status: 'unreadable' });

    bridgeWindow.reformElectron = { legacyRead: async () => '{oops' };
    expect(await savefileDiskLegacyRead()).toEqual({ status: 'unreadable' });
  });
});
