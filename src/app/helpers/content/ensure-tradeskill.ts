import type {
  CollectibleId,
  TradeskillContent,
  TradeskillId,
  TradeskillLevelRequirementContent,
  TradeskillLevelRequirementId,
} from '@interfaces';

export function ensureTradeskill(
  tradeskill: Partial<TradeskillContent>,
): Required<TradeskillContent> {
  return {
    id: tradeskill.id ?? ('UNKNOWN' as TradeskillId),
    name: tradeskill.name ?? 'UNKNOWN',
    __type: 'tradeskill',
    sprite: tradeskill.sprite ?? 'UNKNOWN',
    description: tradeskill.description ?? 'UNKNOWN',
  };
}

export function ensureTradeskillLevelRequirement(
  requirement: Partial<TradeskillLevelRequirementContent>,
): Required<TradeskillLevelRequirementContent> {
  return {
    id: requirement.id ?? ('UNKNOWN' as TradeskillLevelRequirementId),
    name: requirement.name ?? 'UNKNOWN',
    __type: 'tradeskilllevelrequirement',
    tradeskillId: requirement.tradeskillId ?? ('UNKNOWN' as TradeskillId),
    level: requirement.level ?? 1,
    requiredCollectibleId:
      requirement.requiredCollectibleId ?? ('UNKNOWN' as CollectibleId),
  };
}
