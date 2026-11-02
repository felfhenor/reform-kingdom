import type { LegacyState } from '@interfaces/legacy';
import type { GameState } from '@interfaces/state-game';

export type SavefileBackupReason = 'load' | 'import' | 'restore';

export type SavefileBackup = {
  id: string;
  createdAt: number;
  reason: SavefileBackupReason;
  gameId: string;
  numTicks: number;
  state: GameState;
};

export type SavefileStorage = 'browser' | 'disk';

export type SavefileBackupSource = SavefileStorage;

export type SavefileBackupReadResult = {
  backups: SavefileBackup[];
  unreadableSources: SavefileBackupSource[];
};

export type SavefileLoadFailureReason = 'storage' | 'invalid' | 'migration';

export type SavefileLoadStatus =
  | { state: 'pending' }
  | { state: 'ok' }
  | {
      state: 'failed';
      reason: SavefileLoadFailureReason;
      details: string[];
      data?: unknown;
    };

export type ElectronSavefileBridge = {
  savefileBackupWrite: (id: string, json: string) => Promise<void>;
  savefileBackupReadAll: () => Promise<string[]>;
  savefileBackupPrune: (keepIds: string[]) => Promise<void>;
};

export type WindowWithElectronBridge = Window & {
  reformElectron?: ElectronSavefileBridge;
};

export type ElectronSavefileStoreBridge = {
  savefileWrite: (json: string) => Promise<boolean>;
  savefileRead: () => Promise<string | undefined>;
  savefileOpenFolder: () => Promise<boolean>;
  savefileExportWithLogs: () => Promise<boolean>;
};

export type WindowWithElectronSavefileStoreBridge = Window & {
  reformElectron?: Partial<ElectronSavefileStoreBridge>;
};

// An exported .rek file; older files are a bare GameState.
export type SavefileBundle = {
  format: 'reform-kingdom-bundle';
  version: number;
  savefile: GameState;
  legacy?: LegacyState;
};

// Sections are left unchecked here so each one is validated on its own.
export type SavefileBundleSections = {
  savefile: unknown;
  legacy?: unknown;
};
