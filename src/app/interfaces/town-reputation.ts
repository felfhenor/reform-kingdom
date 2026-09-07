export type TownReputationGainSource =
  | 'Trade'
  | 'Craft'
  | 'Commission'
  | 'RaidDefense';

// Display-only shape for the panel's reputation progress bar.
export type TownReputationDisplay = {
  reputation: number;
  tierName: string;
  nextThreshold?: number;
  nextTierName?: string;
};
