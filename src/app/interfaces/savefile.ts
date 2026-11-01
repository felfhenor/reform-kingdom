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
