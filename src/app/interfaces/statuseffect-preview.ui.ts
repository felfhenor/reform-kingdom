import type { Icon } from '@interfaces/artable';
import type { CombatantStatusEffectData } from '@interfaces/combat';
import type {
  StatusEffectContent,
  StatusEffectId,
  StatusEffectTag,
  StatusEffectTrigger,
} from '@interfaces/content-statuseffect';
import type { GameElement } from '@interfaces/element';
import type { GameStat } from '@interfaces/stat';

export const CombatantStatusEffectDataLabel: Record<
  keyof CombatantStatusEffectData,
  string
> = {
  isFrozen: 'Frozen (cannot act)',
};

// Held while the effect is active, or reapplied every time it ticks.
export type StatusEffectPreviewTiming = 'Active' | 'PerTurn';

// Signed from the afflicted combatant's view; flags (e.g. Frozen) have no amount.
export type StatusEffectPreviewModifier = {
  label: string;
  amount?: number;
  isPercent: boolean;
  timing: StatusEffectPreviewTiming;
  stat?: GameStat;
  icon?: Icon;
};

export type StatusEffectPreview = {
  id: StatusEffectId;
  name: string;
  sprite: string;
  effectType: StatusEffectContent['effectType'];
  elements: GameElement[];
  tags: StatusEffectTag[];
  trigger: StatusEffectTrigger;
  turnsRemaining: number;
  damagePerTurn: number;
  healingPerTurn: number;
  modifiers: StatusEffectPreviewModifier[];
};
