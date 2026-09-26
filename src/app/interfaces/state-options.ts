import type { AdventureLogEntryKind } from '@interfaces/combat-log';

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
  | 'partyViewAlwaysExpand'
  | 'craftingViewAlwaysExpand'
  | 'adventureLogOverlay';

export type NotificationCategory = 'Error' | 'Success';

export type OptionsTab = 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';

export type GameOptions = Record<GameOption, boolean> & {
  uiTheme: string;
  sfxVolume: number;
  bgmVolume: number;
  debugTickMultiplier: number;
  debugSaveInterval: number;
  optionsTab: OptionsTab;
  mapZoom: number;
  adventureLogOverlayKinds: Record<AdventureLogEntryKind, boolean>;
};
