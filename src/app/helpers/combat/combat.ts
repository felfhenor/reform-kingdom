import {
  combatantIsDead,
  combatCombatantTakeDamage,
} from '@helpers/combat/combat-combatant-hp';
import { combatCheckIfOver } from '@helpers/combat/combat-end';
import {
  beginCombatLogCommits,
  combatantMessageToken,
  combatMessageLog,
  endCombatLogCommits,
} from '@helpers/combat/combat-log';
import {
  combatantTakesOrders,
  combatIsManual,
  combatManualAwaitingOrders,
  combatManualEscaped,
  combatManualNeedsOrders,
  combatManualPick,
} from '@helpers/combat/combat-manual';
import { pickSkillFromCombatOrders } from '@helpers/combat/combat-order-evaluation';
import { combatantPickSkill } from '@helpers/combat/combat-skill-pick';
import {
  combatantFireDelayedSkills,
  combatantUseSkill,
} from '@helpers/combat/combat-skill-use';
import { combatantTickSkillCooldowns } from '@helpers/combat/combat-skill-cooldown';
import { combatantPaySkillCast } from '@helpers/combat/combat-skill-elements';
import { combatantQueueDelayedSkill } from '@helpers/combat/combat-skill-delay';
import { combatantSkillCastEventEmit } from '@helpers/combat/combat-skill-events';
import {
  combatCanTakeTurn,
  combatExpireCombatantStatusEffects,
  combatTickCombatantStatusEffects,
  combatUnapplyAllStatusEffects,
} from '@helpers/combat/combat-statuseffects';
import {
  combatRoundQueue,
  combatTurnCombatant,
} from '@helpers/combat/combat-turn-queue';
import {
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkill,
} from '@helpers/combat/combat-targetting';
import {
  runStatsCombatBegin,
  runStatsCombatFlush,
  runStatsRecordSkillUse,
} from '@helpers/run-stats/run-stats-combat';
import {
  gamestateFreezeSubtree,
  updateGamestate,
  worldCombatState,
} from '@helpers/state-game';

import { clamp } from 'es-toolkit/compat';

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantSkillEpCost,
} from '@helpers/combat/combat-stats';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatQueuedTurnOutcome,
  CombatTurn,
  CombatTurnStart,
  EquipmentSkill,
} from '@interfaces';

type CombatTurnResult = {
  takeAnotherTurn?: boolean;
};

function combatantMarkSkillUse(
  combatant: Combatant,
  skill: EquipmentSkill,
): void {
  combatant.skillUses[skill.id] ??= 0;
  combatant.skillUses[skill.id] += 1;

  combatant.ep = clamp(
    combatant.ep - combatCombatantSkillEpCost(combatant, skill),
    0,
    combatant.totalStats.Energy,
  );
}

function combatantLogIfDefeated(combat: Combat, combatant: Combatant): boolean {
  if (!combatantIsDead(combatant)) return false;

  combatMessageLog(
    combat,
    `**${combatantMessageToken(combatant)}** has been defeated!`,
    combatant,
  );
  return true;
}

function combatantCanAct(combat: Combat, combatant: Combatant): boolean {
  if (!combatCanTakeTurn(combatant)) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(combatant)}** lost their turn!`,
    );
    return false;
  }

  const isStunned = combatCombatantCombatStatSucceedsChance(
    combatant,
    'stunChance',
  );

  if (isStunned) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(combatant)}** is stunned and loses their turn!`,
    );
    return false;
  }

  return true;
}

// Returns whether the combatant actually acted, which gates an extra turn.
function combatantAct(combat: Combat, combatant: Combatant): boolean {
  const skills = combatAvailableSkillsForCombatant(combat, combatant).filter(
    (s) =>
      combatGetPossibleCombatantTargetsForSkill(combat, combatant, s).length >
      0,
  );

  // Manual orders, then Combat Orders, override the weighted-random pick.
  const takesOrders = combatantTakesOrders(combat, combatant);
  const combatOrderPick = takesOrders
    ? combatManualPick(combat, combatant, skills)
    : !combatant.isEnemy && combatant.combatOrders.length > 0
      ? pickSkillFromCombatOrders(combat, combatant, skills)
      : undefined;
  if (takesOrders && !combatOrderPick) return false;

  const chosenSkill =
    combatOrderPick?.skill ?? combatantPickSkill(combatant, skills);
  if (!chosenSkill) return false;

  combatantMarkSkillUse(combatant, chosenSkill);
  runStatsRecordSkillUse(combat, combatant, chosenSkill.family);
  combatantSkillCastEventEmit(
    combatant.id,
    chosenSkill.name,
    chosenSkill.sprite,
  );
  combatantPaySkillCast(combat, combatant, chosenSkill);

  if (chosenSkill.delay > 0) {
    combatantQueueDelayedSkill(combatant, chosenSkill, combatOrderPick);
    return true;
  }

  combatantUseSkill(combat, combatant, chosenSkill, combatOrderPick);
  return true;
}

export function combatantStartTurn(
  combat: Combat,
  combatant: Combatant,
): CombatTurnStart {
  if (combatantIsDead(combatant)) {
    if (rngSucceedsChance(combatant.combatStats.reviveChance)) {
      combatMessageLog(
        combat,
        `**${combatantMessageToken(combatant)}** has sprung to life!`,
        combatant,
      );

      combatCombatantTakeDamage(combatant, -combatant.totalStats.Health);

      combatUnapplyAllStatusEffects(combat, combatant);
    } else {
      combatMessageLog(
        combat,
        `**${combatantMessageToken(combatant)}** is dead, skipping turn.`,
      );
      return 'over';
    }
  }

  combatantTickSkillCooldowns(combatant);

  const firedDelayed = combatantFireDelayedSkills(combat, combatant);
  if (firedDelayed && combatantLogIfDefeated(combat, combatant)) return 'over';

  combatTickCombatantStatusEffects(combat, combatant, 'TurnStart');

  if (combatantLogIfDefeated(combat, combatant)) return 'over';

  return combatantCanAct(combat, combatant) ? 'ready' : 'lost';
}

export function combatantFinishTurn(
  combat: Combat,
  combatant: Combatant,
  canAct: boolean,
): CombatTurnResult {
  const acted = canAct && combatantAct(combat, combatant);

  combatTickCombatantStatusEffects(combat, combatant, 'TurnEnd');
  combatExpireCombatantStatusEffects(combat, combatant);

  if (combatantLogIfDefeated(combat, combatant)) return {};

  if (!acted) return {};

  const shouldGoAgain = combatCombatantCombatStatSucceedsChance(
    combatant,
    'repeatActionChance',
  );

  if (shouldGoAgain) {
    return {
      takeAnotherTurn: true,
    };
  }

  return {};
}

export function combatantTakeTurn(
  combat: Combat,
  combatant: Combatant,
): CombatTurnResult {
  const start = combatantStartTurn(combat, combatant);
  if (start === 'over') return {};
  return combatantFinishTurn(combat, combatant, start === 'ready');
}

function combatWaitStartDelay(current: Combat): boolean {
  const delay = current.startDelayTicks ?? 0;
  if (delay <= 0) return false;

  updateGamestate((state) => {
    if (state.world.combat) state.world.combat.startDelayTicks = delay - 1;
    return state;
  });
  return true;
}

export function combatDoCombatIteration(): void {
  const current = worldCombatState();
  if (!current) return;
  if (combatWaitStartDelay(current)) return;

  if (combatCheckIfOver(current)) return;
  if (combatManualAwaitingOrders(current)) return;

  // The engine mutates combatants in place and committed state is frozen, so each step works on its own copy.
  const combat = structuredClone(current);

  beginCombatLogCommits();
  runStatsCombatBegin();

  const escaped = combatIsManual()
    ? combatDoManualStep(combat)
    : combatDoRound(combat);
  if (escaped) combatMessageLog(combat, 'The party escaped!');
  gamestateFreezeSubtree(combat);
  updateGamestate((state) => {
    state.world.combat = escaped ? undefined : combat;
    runStatsCombatFlush(state);
    return state;
  });

  // Manual fights end on the next tick so the overlay can show the killing blow's state first.
  if (!escaped && !combatIsManual()) combatCheckIfOver(combat);

  endCombatLogCommits();
}

// Picks up where a manual fight left a round half-played.
function combatDoRound(combat: Combat): boolean {
  const queue = (combat.turnQueue ??= combatBeginRound(combat));
  while (queue.length > 0) combatTakeQueuedTurn(combat, queue);
  return combatEndRound(combat);
}

// One turn per tick so each lands on screen; the skipped turns of the dead ride along with the next.
function combatDoManualStep(combat: Combat): boolean {
  const queue = (combat.turnQueue ??= combatBeginRound(combat));
  let outcome: CombatQueuedTurnOutcome = 'skipped';
  while (outcome === 'skipped' && queue.length > 0) {
    outcome = combatTakeQueuedTurn(combat, queue);
  }
  return queue.length === 0 ? combatEndRound(combat) : false;
}

function combatBeginRound(combat: Combat): CombatTurn[] {
  combatMessageLog(
    combat,
    combat.ambushedBy
      ? `**${combat.ambushedBy}** sprung an ambush!`
      : `_Combat round ${combat.rounds + 1}._`,
  );
  return combatRoundQueue(combat);
}

// Returns whether a fleeing party got away.
function combatEndRound(combat: Combat): boolean {
  combat.turnQueue = undefined;
  if (combat.ambushedBy) combat.ambushedBy = undefined;
  else combatCountRound(combat);

  const escaped = combatManualEscaped(combat);
  combat.manualFlee = undefined;
  return escaped;
}

function combatTakeQueuedTurn(
  combat: Combat,
  queue: CombatTurn[],
): CombatQueuedTurnOutcome {
  const turn = queue[0];
  const combatant = combatTurnCombatant(combat, turn);
  const wasDead = !combatant || combatantIsDead(combatant);
  const result = combatant ? combatPlayTurn(combat, turn, combatant) : {};
  if (result === 'waiting') return 'waiting';

  queue.shift();
  combat.manualAction = undefined;
  if (combatant && result.takeAnotherTurn && !turn.bonus) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(combatant)}** was blessed by the elements, and gets to go again!`,
    );
    queue.unshift({ combatantId: combatant.id, bonus: true });
  }
  return wasDead && (!combatant || combatantIsDead(combatant))
    ? 'skipped'
    : 'taken';
}

// A hero who needs orders stops after the start of the turn and resumes there once they arrive.
function combatPlayTurn(
  combat: Combat,
  turn: CombatTurn,
  combatant: Combatant,
): CombatTurnResult | 'waiting' {
  if (turn.awaitingOrders) {
    if (combat.manualFlee) combatMessageLog(combat, 'The party tries to flee!');
    return combatantFinishTurn(combat, combatant, true);
  }

  const start = combatantStartTurn(combat, combatant);
  if (start === 'over') return {};
  if (start === 'ready' && combatManualNeedsOrders(combat, combatant)) {
    turn.awaitingOrders = true;
    return 'waiting';
  }
  return combatantFinishTurn(combat, combatant, start === 'ready');
}

function combatCountRound(combat: Combat): void {
  const previousRounds = combat.rounds;
  combat.rounds++;

  const previousMultiplierTier = Math.floor(previousRounds / 25);
  const currentMultiplierTier = Math.floor(combat.rounds / 25);

  if (
    currentMultiplierTier > previousMultiplierTier &&
    currentMultiplierTier > 0
  ) {
    const damageIncreasePercent = currentMultiplierTier * 25;
    combatMessageLog(
      combat,
      `Due to exhaustion, damage received is increased by ${damageIncreasePercent}% for all combatants.`,
    );
  }
}
