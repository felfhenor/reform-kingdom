import type { CollectibleId } from '@interfaces/content-collectible';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { Tradeskill } from '@interfaces/tradeskill';

export type TradeskillLevelRequirementId = Branded<
  string,
  'TradeskillLevelRequirementId'
>;

export type TradeskillLevelRequirementContent = IsContentItem & {
  id: TradeskillLevelRequirementId;
  __type: 'tradeskilllevelrequirement';
  tradeskill: Tradeskill;
  level: number;
  requiredCollectibleId: CollectibleId;
};
