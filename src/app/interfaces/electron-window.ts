// Sizes are physical pixels; the main process converts to and from display-scaled units.
export type ElectronWindowState = {
  fullscreen: boolean;
  maximized: boolean;
  scaleFactor: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

export type ElectronWindowBridge = {
  windowGet: () => Promise<ElectronWindowState | undefined>;
  windowSetFullscreen: (
    fullscreen: boolean,
  ) => Promise<ElectronWindowState | undefined>;
  windowSetSize: (
    width: number,
    height: number,
  ) => Promise<ElectronWindowState | undefined>;
  windowOnChange: (
    callback: (state: ElectronWindowState) => void,
  ) => () => void;
  windowOnSaveBeforeClose: (callback: () => Promise<boolean>) => () => void;
};

export type WindowWithElectronWindowBridge = Window & {
  reformElectron?: Partial<ElectronWindowBridge>;
};

export type WindowDisplayMode = 'windowed' | 'fullscreen';

export type WindowSizeChoice = {
  id: string;
  label: string;
  width: number;
  height: number;
};
