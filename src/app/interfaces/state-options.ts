import type { AdventureLogEntryKind } from '@interfaces/combat-log';
import type { DesktopNotificationCategory } from '@interfaces/electron-window';

export type GameOption =
  | 'showDebug'
  | 'debugConsoleLogStateUpdates'
  | 'debugGameloopTimerUpdates'
  | 'sfxPlay'
  | 'bgmPlay'
  | 'gameloopPaused'
  | 'showBackdropGrid'
  | 'analyticsEnabled'
  | 'analyticsOptInDismissed'
  | 'demoImportDismissed'
  | 'partyViewAlwaysExpand'
  | 'craftingViewAlwaysExpand'
  | 'adventureLogOverlay'
  | 'cleanFont'
  | 'colorblindMode'
  | 'runInBackground'
  | 'muteWhenUnfocused'
  | 'lowerFrameRateWhenUnfocused'
  | 'desktopNotifications'
  | 'flashTaskbarOnAlerts'
  | 'skipFeatureTutorials'
  | 'skipLosingStreakTutorial';

export type UiScale = 'auto' | number;

export type MotionPreference = 'system' | 'reduced' | 'full';

export type NotificationCategory = 'Error' | 'Success' | 'Warning';

export type OptionsTab = 'UI' | 'Accessibility' | 'Savefile' | 'Misc' | 'Debug';

export type GameOptions = Record<GameOption, boolean> & {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  debugTickMultiplier: number;
  autosaveInterval: number;
  optionsTab: OptionsTab;
  mapZoom: number;
  mapFrameRate: number;
  uiScale: UiScale;
  motionPreference: MotionPreference;
  adventureLogOverlayKinds: Record<AdventureLogEntryKind, boolean>;
  desktopNotificationKinds: Record<DesktopNotificationCategory, boolean>;
  modsEnabled: string[];
};
