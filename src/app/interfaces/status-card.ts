import type { AtlasedImage } from '@interfaces/artable';

export type StatusCardBar = {
  variant: 'hp' | 'xp' | 'ep';
  percent: number;
  current: number;
  max: number;
};

// Display-only shape for one encounter-corner card.
export type StatusCardEntry = {
  combatantId: string;
  name: string;
  // Only heroes have a "Lv. X Job" subtitle - a monster's level/letter is
  // already baked into `name`.
  subtitleLevel?: number;
  subtitleLabel?: string;
  spritesheet: AtlasedImage;
  spriteAssetName: string;
  spriteFrames: number;
  isDead: boolean;
  bars: StatusCardBar[];
};
