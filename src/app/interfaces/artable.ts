import type { ALL_ICONS } from '@helpers/engine/icons';

export type Icon = keyof typeof ALL_ICONS;

export type HasSprite = {
  sprite: string;
};

export type HasAnimation = HasSprite & {
  frames: number;
};

export type AtlasedImage =
  | 'collectible'
  | 'equipment'
  | 'globaleffect'
  | 'item'
  | 'job'
  | 'monster'
  | 'skill'
  | 'tradeskill'
  | 'worker';
