import type { AtlasedImage } from '@interfaces/artable';
import type { StatusEffectPreview } from '@interfaces/statuseffect-preview.ui';

export type StatusCardBar = {
  variant: 'hp' | 'xp' | 'ep';
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
  // Only set while the combatant is in a fight.
  statusEffects?: StatusEffectPreview[];
};
