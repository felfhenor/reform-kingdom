export type ContentType =
  'collectible' | 'equipment' | 'item' | 'job' | 'monster' | 'skill' | 'trait';

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
