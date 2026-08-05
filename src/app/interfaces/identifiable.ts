export type ContentType =
  | 'collectible'
  | 'encounter'
  | 'equipment'
  | 'gathering'
  | 'globaleffect'
  | 'item'
  | 'job'
  | 'monster'
  | 'recipe'
  | 'skill'
  | 'statuseffect'
  | 'trait';

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
