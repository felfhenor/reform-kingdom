export type SteamBridge = {
  steamAchievementsActivate: (names: string[]) => Promise<string[]>;
  steamAchievementClear: (name: string) => Promise<boolean>;
};

export type WindowWithSteamBridge = Window & {
  reformElectron?: Partial<SteamBridge>;
};
