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
  | 'adventureLogOverlay'
  | 'cleanFont'
  | 'colorblindMode';

export type UiScale = 'auto' | number;

export type MotionPreference = 'system' | 'reduced' | 'full';

export type NotificationCategory = 'Error' | 'Success' | 'Warning';

export type OptionsTab = 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';

export type GameOptions = Record<GameOption, boolean> & {
  sfxVolume: number;
  bgmVolume: number;
  debugTickMultiplier: number;
  debugSaveInterval: number;
  optionsTab: OptionsTab;
  mapZoom: number;
  uiScale: UiScale;
  motionPreference: MotionPreference;
  adventureLogOverlayKinds: Record<AdventureLogEntryKind, boolean>;
};
