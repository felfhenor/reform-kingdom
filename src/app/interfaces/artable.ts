import type { ALL_ICONS } from '@helpers';

export type Icon = keyof typeof ALL_ICONS;

export interface HasSprite {
  sprite: string;
}

export type HasAnimation = HasSprite & {
  frames: number;
};

export type AtlasedImage =
  | 'hero'
  | 'item'
  | 'monster'
  | 'pet'
  | 'trinket'
  | 'weapon';
