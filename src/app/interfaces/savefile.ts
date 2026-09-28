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

export type SavefileBackupSource = 'browser' | 'disk';

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
