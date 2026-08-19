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
  | 'analyticsEnabled'
  | 'analyticsOptInDismissed'
  | 'partyViewAutoCollapse';

export type NotificationCategory = 'Error' | 'Success';

export type OptionsTab = 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';

export type OptionsTabLink = {
  name: 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';
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
  mapZoom: number;
};
