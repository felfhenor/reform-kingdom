import type { GameElement } from '@interfaces/element';
import type { SkillStatScaling } from '@interfaces/stat';

export type SkillTechniqueKind =
  'Damage' | 'Heal' | 'Buff' | 'Debuff' | 'Effect';

// `count` is omitted when the noun already says it all (e.g. "Self", "All allies").
export type SkillTechniqueTargeting = {
  count?: number;
  noun: string;
};

export type SkillTechniqueStatusPreview = {
  name: string;
  chance: number;
  duration: number;
};

// One technique of a skill, in the order it fires in combat.
export type SkillTechniquePreview = {
  kind: SkillTechniqueKind;
  // Only meaningful for Damage/Heal kinds; 0 otherwise.
  amount: number;
  targeting: SkillTechniqueTargeting;
  conditions: string[];
  scaling: SkillStatScaling[];
  elements: GameElement[];
  statusEffects: SkillTechniqueStatusPreview[];
};
