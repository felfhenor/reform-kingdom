import type { Signal } from '@angular/core';

export type GameOption =
  | 'showDebug'
  | 'debugConsoleLogStateUpdates'
  | 'debugGameloopTimerUpdates'
  | 'debugAllowBackgroundOperations'
  | 'sfxPlay'
  | 'bgmPlay'
  | 'gameloopPaused';

export type NotificationCategory = 'Error' | 'Success';

export type OptionsTab = 'UI' | 'Savefile' | 'Debug';

export interface OptionsTabLink {
  name: 'UI' | 'Savefile' | 'Debug';
  link: OptionsTab;
  showIf: Signal<boolean>;
}

export type GameOptions = Record<GameOption, boolean> & {
  uiTheme: string;
  sfxVolume: number;
  bgmVolume: number;
  debugTickMultiplier: number;
  debugSaveInterval: number;
  optionsTab: OptionsTab;
};
