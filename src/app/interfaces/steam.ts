export type SteamBridge = {
  steamAchievementsActivate: (names: string[]) => Promise<string[]>;
  steamAchievementClear: (name: string) => Promise<boolean>;
  steamInputType: () => Promise<string | undefined>;
};

export type WindowWithSteamBridge = Window & {
  reformElectron?: Partial<SteamBridge>;
};
