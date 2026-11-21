export type SteamBridge = {
  steamAchievementsActivate: (names: string[]) => Promise<string[]>;
  steamAchievementClear: (name: string) => Promise<boolean>;
  steamInputType: () => Promise<string | undefined>;
  steamShowKeyboard: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<boolean>;
};

export type WindowWithSteamBridge = Window & {
  reformElectron?: Partial<SteamBridge>;
};
