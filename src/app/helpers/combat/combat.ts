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
import { combatHasCombatant } from '@helpers/combat/combat-summon';
import {
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkill,
} from '@helpers/combat/combat-targetting';
import {
  runStatsCombatBegin,
  runStatsCombatFlush,
  runStatsRecordSkillUse,
} from '@helpers/run-stats/run-stats-combat';
import { updateGamestate, worldCombatState } from '@helpers/state-game';

import { clamp, sortBy } from 'es-toolkit/compat';

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantSkillEpCost,
} from '@helpers/combat/combat-stats';
import { rngSucceedsChance } from '@helpers/rng';
import type { Combat, Combatant, EquipmentSkill } from '@interfaces';

type CombatTurnResult = {
  takeAnotherTurn?: boolean;
};

function orderCombatantsByAgility(combat: Combat): Combatant[] {
  return sortBy(
    [...combat.guardians, ...combat.heroes, ...combat.helpers],
    (c) => -c.totalStats.Agility,
  );
}

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
  if (!combatantCanAct(combat, combatant)) return false;

  const skills = combatAvailableSkillsForCombatant(combat, combatant).filter(
    (s) =>
      combatGetPossibleCombatantTargetsForSkill(combat, combatant, s).length >
      0,
  );

  // Combat Orders override the weighted-random pick only if the hero has any configured.
  const combatOrderPick =
    !combatant.isEnemy && combatant.combatOrders.length > 0
      ? pickSkillFromCombatOrders(combat, combatant, skills)
      : undefined;

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

export function combatantTakeTurn(
  combat: Combat,
  combatant: Combatant,
): CombatTurnResult {
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
      return {};
    }
  }

  combatantTickSkillCooldowns(combatant);

  const firedDelayed = combatantFireDelayedSkills(combat, combatant);
  if (firedDelayed && combatantLogIfDefeated(combat, combatant)) return {};

  combatTickCombatantStatusEffects(combat, combatant, 'TurnStart');

  if (combatantLogIfDefeated(combat, combatant)) return {};

  const acted = combatantAct(combat, combatant);

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

  // The engine mutates combatants in place and committed state is frozen, so each round works on its own copy.
  const combat = structuredClone(current);

  beginCombatLogCommits();
  runStatsCombatBegin();

  if (combat.ambushedBy) {
    combatDoAmbushRound(combat);
  } else {
    combatDoRound(combat);
  }

  updateGamestate((state) => {
    state.world.combat = combat;
    runStatsCombatFlush(state);
    return state;
  });

  combatCheckIfOver(combat);

  endCombatLogCommits();
}

// A summon replaced earlier this round no longer acts; an elemental blessing grants one extra turn.
function combatantTakeRoundTurn(combat: Combat, char: Combatant): void {
  if (!combatHasCombatant(combat, char)) return;

  const res = combatantTakeTurn(combat, char);

  if (res?.takeAnotherTurn) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(char)}** was blessed by the elements, and gets to go again!`,
    );
    combatantTakeTurn(combat, char);
  }
}

// Only living heroes act, and it isn't a counted round, so the exhaustion timer doesn't move.
function combatDoAmbushRound(combat: Combat): void {
  combatMessageLog(combat, `**${combat.ambushedBy}** sprung an ambush!`);

  orderCombatantsByAgility(combat)
    .filter((char) => combat.heroes.includes(char) && !combatantIsDead(char))
    .forEach((char) => combatantTakeRoundTurn(combat, char));

  combat.ambushedBy = undefined;
}

function combatDoRound(combat: Combat): void {
  combatMessageLog(combat, `_Combat round ${combat.rounds + 1}._`);

  orderCombatantsByAgility(combat).forEach((char) =>
    combatantTakeRoundTurn(combat, char),
  );

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
