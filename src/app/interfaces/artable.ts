import type { ALL_ICONS } from '@helpers/engine/icons';

export type Icon = keyof typeof ALL_ICONS;

// `IconComponent`'s `size` input; values resolved via `ICON_SIZE_VALUES` in helpers/engine/icons.ts.
export type IconSize = 'badge' | 'inline' | 'row' | 'stat' | 'nav';

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
