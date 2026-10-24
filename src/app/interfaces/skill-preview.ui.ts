import type { Combatant } from '@interfaces/combat';
import type { GameElement } from '@interfaces/element';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { SkillStatScaling } from '@interfaces/stat';

export type SkillTechniqueKind =
  | 'Damage'
  | 'Heal'
  | 'Buff'
  | 'Debuff'
  | 'Effect'
  | 'Restore'
  | 'Drain'
  | 'Shield'
  | 'Summon';

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
  // Charges this technique adds to the combat element pool.
  generatedElements: GameElement[];
  statusEffects: SkillTechniqueStatusPreview[];
  // 100 when the technique can't miss on its own.
  accuracy: number;
  summonName?: string;
};

// Who a skill tooltip previews against, built once per hero and shared by every tooltip in a view.
export type SkillPreviewContext = {
  combatant: Combatant;
  weaponTypes: EquipmentItemType[];
};
