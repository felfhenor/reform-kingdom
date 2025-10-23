export type ContentType =
  | 'hero'
  | 'item'
  | 'monster'
  | 'pet'
  | 'stage'
  | 'trinket'
  | 'weapon';

export interface Identifiable {
  id: string;
  name: string;
}

export type IsContentItem = Identifiable & {
  __type: ContentType;
};

declare const __brand: unique symbol;

export type Branded<T, K> = T & {
  readonly [__brand]: K;
};
