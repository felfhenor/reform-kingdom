export type ContentType =
  | 'affix'
  | 'astralprojector'
  | 'caravan'
  | 'caravantrader'
  | 'collectible'
  | 'commissionoffer'
  | 'encounter'
  | 'encounterrandom'
  | 'equipment'
  | 'exchangenode'
  | 'gathering'
  | 'globaleffect'
  | 'item'
  | 'job'
  | 'jobability'
  | 'monster'
  | 'nodeoverride'
  | 'outpost'
  | 'recipe'
  | 'region'
  | 'shrine'
  | 'skill'
  | 'skilltreenode'
  | 'statuseffect'
  | 'task'
  | 'town'
  | 'tradeskill'
  | 'tradeskilllevelrequirement'
  | 'trainer'
  | 'trainerteaching'
  | 'worker';

export type Identifiable = {
  id: string;
  name: string;
};

export type IsContentItem = Identifiable & {
  __type: ContentType;
};

declare const __brand: unique symbol;

export type Branded<T, K> = T & {
  readonly [__brand]: K;
};
