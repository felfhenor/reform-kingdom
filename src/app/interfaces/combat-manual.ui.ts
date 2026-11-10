import type { Combatant, CombatManualAction } from '@interfaces/combat';
import type { CombatLogIcon } from '@interfaces/combat-log';
import type { EquipmentSkill } from '@interfaces/content-skill';

// Empty targets = the round fills them, so the player doesn't pick one; autoTargetLabel says who.
export type CombatManualSkillOption = {
  skill: EquipmentSkill;
  targets: Combatant[];
  autoTargetLabel: string;
  // Undefined for a self-only skill.
  targetCount?: number;
  epCost: number;
  disabledReason?: string;
};

export type CombatManualOrder = CombatManualAction & {
  skillName: string;
  skillSprite: string;
  targetLabel: string;
  targetIcon?: CombatLogIcon;
};
