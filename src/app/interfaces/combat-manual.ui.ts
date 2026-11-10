import type { Combatant } from '@interfaces/combat';
import type { CombatLogIcon } from '@interfaces/combat-log';
import type { EquipmentSkill } from '@interfaces/content-skill';

// Empty targets = the engine fills them, so the player doesn't pick one; autoTargetLabel says who.
export type CombatManualSkillOption = {
  skill: EquipmentSkill;
  targets: Combatant[];
  autoTargetLabel: string;
  // Undefined for a self-only skill.
  targetCount?: number;
  epCost: number;
  disabledReason?: string;
};

export type CombatManualTurnSlot =
  | {
      kind: 'turn';
      key: string;
      id: string;
      name: string;
      isEnemy: boolean;
      icon: CombatLogIcon;
    }
  | { kind: 'divider'; key: string; round: number };
