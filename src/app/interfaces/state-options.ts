import type { Signal } from '@angular/core';

export type GameOption =
  | 'showDebug'
  | 'debugConsoleLogStateUpdates'
  | 'debugGameloopTimerUpdates'
  | 'debugAllowBackgroundOperations'
  | 'sfxPlay'
  | 'bgmPlay'
  | 'gameloopPaused'
  | 'showBackdropGrid'
  | 'analyticsEnabled';

export type NotificationCategory = 'Error' | 'Success';

export type OptionsTab = 'UI' | 'Savefile' | 'Misc' | 'Debug';

export type OptionsTabLink = {
  name: 'UI' | 'Savefile' | 'Misc' | 'Debug';
  link: OptionsTab;
  showIf: Signal<boolean>;
};

export type GameOptions = Record<GameOption, boolean> & {
  uiTheme: string;
  sfxVolume: number;
  bgmVolume: number;
  debugTickMultiplier: number;
  debugSaveInterval: number;
  optionsTab: OptionsTab;
};
