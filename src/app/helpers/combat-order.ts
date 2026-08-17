import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CharacterId,
  CombatantTargettingType,
  CombatOrderAction,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatOrderComparator,
  CombatOrderCondition,
  JobId,
} from '@interfaces';

export const COMBAT_ORDER_ROW_CAP = 10;

const COMPARATOR_SYMBOLS: Record<CombatOrderComparator, string> = {
  LessThan: '<',
  LessThanOrEqual: '<=',
  Equal: '=',
  GreaterThanOrEqual: '>=',
  GreaterThan: '>',
};

// A short, stock-independent description of when a clause fires - used on
// the Combat Orders modal's clause list. Mirrors `decreeClauseSummary`.
function conditionSummary(condition: CombatOrderCondition): string {
  switch (condition.type) {
    case 'Always':
      return 'Always';
    case 'SelfHealthPercent':
      return `if my Health ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.value}%`;
    case 'SelfEnergyPercent':
      return `if my Energy ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.value}%`;
    case 'AllyCountHealthPercent': {
      const direction =
        condition.healthDirection === 'Above' ? 'above' : 'below';
      return `if allies ${direction} ${condition.healthPercent}% HP ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.count}`;
    }
    case 'EnemyCount':
      return `if enemy count ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.count}`;
  }
}

// A short parenthetical noting where a CastSkillFamily action will land -
// e.g. "(on lowest HP)" - or "(default)" when no override is set, so the
// clause list shows targeting at a glance instead of only on Edit.
function targetModeSuffix(
  targetMode: CombatantTargettingType | undefined,
): string {
  switch (targetMode) {
    case 'Weakest':
      return ' (on lowest HP)';
    case 'Strongest':
      return ' (on highest HP)';
    case 'Random':
      return ' (on random)';
    default:
      return ' (default)';
  }
}

export function combatOrderClauseSummary(clause: CombatOrderClause): string {
  const actionText =
    clause.action.type === 'RandomSkill'
      ? 'Use a random skill'
      : `Cast ${clause.action.family}${targetModeSuffix(clause.action.targetMode)}`;

  const conditionText = conditionSummary(clause.condition);
  return conditionText === 'Always'
    ? actionText
    : `${actionText} ${conditionText}`;
}

export function combatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
): CombatOrderClause[] {
  const character = gamestate().world.party.find((c) => c.id === characterId);
  return character?.combatOrders[jobId] ?? [];
}

// Refuses to add past `COMBAT_ORDER_ROW_CAP`. Returns whether it was added.
export function combatOrderClauseAdd(
  characterId: CharacterId,
  jobId: JobId,
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): boolean {
  if (combatOrderClauses(characterId, jobId).length >= COMBAT_ORDER_ROW_CAP) {
    return false;
  }

  const clause: CombatOrderClause = {
    id: rngUuid() as CombatOrderClauseId,
    enabled: true,
    condition,
    action,
  };

  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) =>
      c.id === characterId
        ? {
            ...c,
            combatOrders: {
              ...c.combatOrders,
              [jobId]: [clause, ...(c.combatOrders[jobId] ?? [])],
            },
          }
        : c,
    );
    return state;
  });

  return true;
}

// Replaces a clause's condition/action in place, keeping its id/enabled and
// its position in the priority list.
export function combatOrderClauseUpdate(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) =>
      c.id === characterId
        ? {
            ...c,
            combatOrders: {
              ...c.combatOrders,
              [jobId]: (c.combatOrders[jobId] ?? []).map((clause) =>
                clause.id === clauseId
                  ? { ...clause, condition, action }
                  : clause,
              ),
            },
          }
        : c,
    );
    return state;
  });
}

export function combatOrderClauseRemove(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) =>
      c.id === characterId
        ? {
            ...c,
            combatOrders: {
              ...c.combatOrders,
              [jobId]: (c.combatOrders[jobId] ?? []).filter(
                (clause) => clause.id !== clauseId,
              ),
            },
          }
        : c,
    );
    return state;
  });
}

export function combatOrderClauseSetEnabled(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
  enabled: boolean,
): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) =>
      c.id === characterId
        ? {
            ...c,
            combatOrders: {
              ...c.combatOrders,
              [jobId]: (c.combatOrders[jobId] ?? []).map((clause) =>
                clause.id === clauseId ? { ...clause, enabled } : clause,
              ),
            },
          }
        : c,
    );
    return state;
  });
}

// Rebuilds the clause list in a new order - the priority list is a simple
// reorderable array, no separate priority field to keep in sync.
export function combatOrderClauseReorder(
  characterId: CharacterId,
  jobId: JobId,
  previousIndex: number,
  newIndex: number,
): void {
  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const clauses = [...(c.combatOrders[jobId] ?? [])];
      const [moved] = clauses.splice(previousIndex, 1);
      if (!moved) return c;

      clauses.splice(newIndex, 0, moved);
      return { ...c, combatOrders: { ...c.combatOrders, [jobId]: clauses } };
    });
    return state;
  });
}
