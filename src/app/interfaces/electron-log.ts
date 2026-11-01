export type LogLevel = 'debug' | 'error' | 'log' | 'info' | 'warn';

export type ElectronLogBridge = {
  logWrite: (level: LogLevel, category: string, message: string) => void;
  logOpenFolder: () => Promise<boolean>;
};

export type WindowWithElectronLogBridge = Window & {
  reformElectron?: Partial<ElectronLogBridge>;
};
