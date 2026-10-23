export type TownReputationGainSource =
  'Trade' | 'Craft' | 'Commission' | 'RaidDefense' | 'RaidBuyoff';

export type TownReputationGainResult = {
  gained: number;
  tierChanged: boolean;
};
