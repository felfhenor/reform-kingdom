import type { CollectibleId } from '@interfaces/content-collectible';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { Branded, IsContentItem } from '@interfaces/identifiable';

export type TradeskillLevelRequirementId = Branded<
  string,
  'TradeskillLevelRequirementId'
>;

export type TradeskillLevelRequirementContent = IsContentItem & {
  id: TradeskillLevelRequirementId;
  __type: 'tradeskilllevelrequirement';
  tradeskillId: TradeskillId;
  level: number;
  requiredCollectibleId: CollectibleId;
};
