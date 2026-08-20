export type ContentType =
  | 'astralprojector'
  | 'caravan'
  | 'caravantrader'
  | 'collectible'
  | 'encounter'
  | 'encounterrandom'
  | 'equipment'
  | 'gathering'
  | 'globaleffect'
  | 'item'
  | 'job'
  | 'monster'
  | 'nodeoverride'
  | 'recipe'
  | 'skill'
  | 'statuseffect'
  | 'trait'
  | 'tradeskill'
  | 'tradeskilllevelrequirement';

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
