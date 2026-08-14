import type { CombatantTargettingType } from '@interfaces/combat';
import type { EquipmentSkill } from '@interfaces/content-skill';
import type { Branded } from '@interfaces/identifiable';

export type CombatOrderClauseId = Branded<string, 'CombatOrderClauseId'>;

export type CombatOrderComparator =
  | 'LessThan'
  | 'LessThanOrEqual'
  | 'Equal'
  | 'GreaterThanOrEqual'
  | 'GreaterThan';

export type CombatOrderHealthDirection = 'Above' | 'Below';

export type CombatOrderCondition =
  | { type: 'Always' }
  | {
      type: 'SelfHealthPercent';
      comparator: CombatOrderComparator;
      value: number;
    }
  | {
      type: 'SelfEnergyPercent';
      comparator: CombatOrderComparator;
      value: number;
    }
  | {
      type: 'AllyCountHealthPercent';
      healthDirection: CombatOrderHealthDirection;
      healthPercent: number;
      comparator: CombatOrderComparator;
      count: number;
    }
  | { type: 'EnemyCount'; comparator: CombatOrderComparator; count: number };

export type CombatOrderAction =
  | {
      type: 'CastSkillFamily';
      family: string;
      targetMode?: CombatantTargettingType;
    }
  | { type: 'RandomSkill' };

export type CombatOrderClause = {
  id: CombatOrderClauseId;
  enabled: boolean;
  condition: CombatOrderCondition;
  action: CombatOrderAction;
};

// The result of walking a combatant's Combat Orders for their turn - the
// skill the first matching clause resolved to, plus that clause's optional
// target-mode override (see `pickSkillFromCombatOrders`).
export type CombatOrderPick = {
  skill: EquipmentSkill;
  targetMode?: CombatantTargettingType;
};
