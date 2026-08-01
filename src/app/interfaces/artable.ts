import type { ALL_ICONS } from '@helpers';

export type Icon = keyof typeof ALL_ICONS;

export type HasSprite = {
  sprite: string;
};

export type HasAnimation = HasSprite & {
  frames: number;
};

export type AtlasedImage =
  'collectible' | 'equipment' | 'item' | 'job' | 'monster' | 'skill';
