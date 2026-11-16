import {
  combatOrderClausesAdd,
  combatOrderClausesRemove,
  combatOrderClausesReorder,
  combatOrderClausesSetEnabled,
  combatOrderClausesUpdate,
  combatOrdersMostEnabled,
} from '@helpers/combat/combat-order';
import { updateGamestate, worldPartyState } from '@helpers/state-game';
import { taskEventCombatOrdersSet } from '@helpers/task/task-events';
import type {
  CharacterId,
  CombatOrderAction,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatOrderComparator,
  CombatOrderCondition,
  JobId,
} from '@interfaces';

const COMPARATOR_SYMBOLS: Record<CombatOrderComparator, string> = {
  LessThan: '<',
  LessThanOrEqual: '<=',
  Equal: '=',
  GreaterThanOrEqual: '>=',
  GreaterThan: '>',
};

export function combatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
): CombatOrderClause[] {
  const character = worldPartyState().find((c) => c.id === characterId);
  return character?.combatOrders[jobId] ?? [];
}

function heroName(characterId: CharacterId): string {
  return (
    worldPartyState().find((c) => c.id === characterId)?.name ?? 'Unknown Hero'
  );
}

// A short, stock-independent description of when a clause fires - used on
// the Combat Orders modal's clause list.
function conditionSummary(condition: CombatOrderCondition): string {
  switch (condition.type) {
    case 'Always':
      return 'Always';
    case 'SelfHealthPercent':
      return `if my Health ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.value}%`;
    case 'SelfEnergyPercent':
      return `if my Energy ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.value}%`;
    case 'AllyCountHealthPercent':
    case 'EnemyCountHealthPercent': {
      const side =
        condition.type === 'AllyCountHealthPercent' ? 'allies' : 'enemies';
      const direction =
        condition.healthDirection === 'Above' ? 'above' : 'below';
      return `if ${side} ${direction} ${condition.healthPercent}% HP ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.count}`;
    }
    case 'EnemyCount':
      return `if enemy count ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.count}`;
    case 'SelfHasNoSummon':
      return 'if I have no summon';
    case 'ElementCount':
      return `if ${condition.element} charges ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.count}`;
    case 'SpecificHeroHealthPercent':
      return `if ${heroName(condition.characterId)}'s Health ${COMPARATOR_SYMBOLS[condition.comparator]} ${condition.value}%`;
  }
}

// A short parenthetical noting where a CastSkillFamily action will land -
// e.g. "(on lowest HP)" - or "(default)" when no override is set, so the
// clause list shows targeting at a glance instead of only on Edit.
function targetModeSuffix(action: CombatOrderAction): string {
  if (action.type !== 'CastSkillFamily') return '';

  switch (action.targetMode) {
    case 'Weakest':
      return ' (on lowest HP)';
    case 'Strongest':
      return ' (on highest HP)';
    case 'Random':
      return ' (on random)';
    case 'Self':
      return ' (on self)';
    case 'SpecificHero':
      return action.targetCharacterId
        ? ` (on ${heroName(action.targetCharacterId)})`
        : ' (on specific hero)';
    case 'MatchingAllies':
      return ' (on matching allies)';
    case 'MatchingEnemies':
      return ' (on matching enemies)';
    default:
      return ' (default)';
  }
}

export function combatOrderClauseSummary(clause: CombatOrderClause): string {
  const actionText =
    clause.action.type === 'RandomSkill'
      ? 'Use a random skill'
      : `Cast ${clause.action.family}${targetModeSuffix(clause.action)}`;

  const conditionText = conditionSummary(clause.condition);
  return conditionText === 'Always'
    ? actionText
    : `${actionText} ${conditionText}`;
}

async function updateCombatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
  transform: (clauses: CombatOrderClause[]) => CombatOrderClause[],
): Promise<void> {
  await updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (!character) return state;

    const current = character.combatOrders[jobId] ?? [];
    const next = transform(current);
    if (next !== current) character.combatOrders[jobId] = next;

    return state;
  });

  await taskEventCombatOrdersSet(combatOrdersMostEnabled(worldPartyState()));
}

export function combatOrderClauseAdd(
  characterId: CharacterId,
  jobId: JobId,
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): void {
  void updateCombatOrderClauses(characterId, jobId, (clauses) =>
    combatOrderClausesAdd(clauses, condition, action),
  );
}

export function combatOrderClauseUpdate(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): void {
  void updateCombatOrderClauses(characterId, jobId, (clauses) =>
    combatOrderClausesUpdate(clauses, clauseId, condition, action),
  );
}

export function combatOrderClauseRemove(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
): void {
  void updateCombatOrderClauses(characterId, jobId, (clauses) =>
    combatOrderClausesRemove(clauses, clauseId),
  );
}

export function combatOrderClauseSetEnabled(
  characterId: CharacterId,
  jobId: JobId,
  clauseId: CombatOrderClauseId,
  enabled: boolean,
): void {
  void updateCombatOrderClauses(characterId, jobId, (clauses) =>
    combatOrderClausesSetEnabled(clauses, clauseId, enabled),
  );
}

export function combatOrderClauseReorder(
  characterId: CharacterId,
  jobId: JobId,
  previousIndex: number,
  newIndex: number,
): void {
  void updateCombatOrderClauses(characterId, jobId, (clauses) =>
    combatOrderClausesReorder(clauses, previousIndex, newIndex),
  );
}
