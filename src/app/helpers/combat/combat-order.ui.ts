import { enumLabel, t } from '@helpers/i18n/i18n';
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
    worldPartyState().find((c) => c.id === characterId)?.name ??
    t('combatOrder.unknownHero')
  );
}

// A short, stock-independent description of when a clause fires - used on
// the Combat Orders modal's clause list.
function conditionSummary(condition: CombatOrderCondition): string {
  const comparator =
    'comparator' in condition ? COMPARATOR_SYMBOLS[condition.comparator] : '';
  switch (condition.type) {
    case 'Always':
      return '';
    case 'SelfHealthPercent':
      return t('combatOrder.condition.selfHealth', {
        comparator,
        value: condition.value,
      });
    case 'SelfEnergyPercent':
      return t('combatOrder.condition.selfEnergy', {
        comparator,
        value: condition.value,
      });
    case 'AllyCountHealthPercent':
    case 'EnemyCountHealthPercent':
      return t(
        `combatOrder.condition.${condition.type === 'AllyCountHealthPercent' ? 'allies' : 'enemies'}${condition.healthDirection === 'Above' ? 'Above' : 'Below'}`,
        {
          percent: condition.healthPercent,
          comparator,
          count: condition.count,
        },
      );
    case 'EnemyCount':
      return t('combatOrder.condition.enemyCount', {
        comparator,
        count: condition.count,
      });
    case 'SelfHasNoSummon':
      return t('combatOrder.condition.noSummon');
    case 'ElementCount':
      return t('combatOrder.condition.elementCount', {
        element: enumLabel('element', condition.element),
        comparator,
        count: condition.count,
      });
    case 'SpecificHeroHealthPercent':
      return t('combatOrder.condition.heroHealth', {
        hero: heroName(condition.characterId),
        comparator,
        value: condition.value,
      });
  }
}

// A short parenthetical noting where a CastSkillFamily action will land -
// e.g. "(on lowest HP)" - or "(default)" when no override is set, so the
// clause list shows targeting at a glance instead of only on Edit.
function targetModeText(action: CombatOrderAction): string {
  if (action.type !== 'CastSkillFamily') return '';

  switch (action.targetMode) {
    case 'Weakest':
    case 'Strongest':
    case 'Random':
    case 'Self':
    case 'MatchingAllies':
    case 'MatchingEnemies':
      return t(`combatOrder.target.${action.targetMode}`);
    case 'SpecificHero':
      return action.targetCharacterId
        ? t('combatOrder.target.SpecificHero', {
            hero: heroName(action.targetCharacterId),
          })
        : t('combatOrder.target.SpecificHeroUnset');
    default:
      return t('combatOrder.target.default');
  }
}

export function combatOrderClauseSummary(clause: CombatOrderClause): string {
  const actionText =
    clause.action.type === 'RandomSkill'
      ? t('combatOrder.randomSkill')
      : t('combatOrder.castOn', {
          family: clause.action.family,
          target: targetModeText(clause.action),
        });

  const conditionText = conditionSummary(clause.condition);
  return conditionText === ''
    ? actionText
    : t('combatOrder.withCondition', {
        action: actionText,
        condition: conditionText,
      });
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
