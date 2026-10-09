import {
  combatantIsDead,
  combatCombatantTakeDamage,
} from '@helpers/combat/combat-combatant-hp';
import {
  combatApplySkillToTarget,
  techniqueHasAttribute,
} from '@helpers/combat/combat-damage';
import { combatCheckIfOver, isCombatOver } from '@helpers/combat/combat-end';
import {
  beginCombatLogCommits,
  combatantMessageToken,
  combatMessageLog,
  endCombatLogCommits,
} from '@helpers/combat/combat-log';
import { pickSkillFromCombatOrders } from '@helpers/combat/combat-order-evaluation';
import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import {
  combatantAdvanceDelayedSkills,
  combatantQueueDelayedSkill,
} from '@helpers/combat/combat-skill-delay';
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
  combatGetPossibleCombatantTargetsForSkillTechnique,
  combatGetTargetsFromPriorityList,
} from '@helpers/combat/combat-targetting';
import { updateGamestate, worldCombatState } from '@helpers/state-game';

import { clamp, sortBy } from 'es-toolkit/compat';

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantSkillEpCost,
} from '@helpers/combat/combat-stats';
import { skillTechniqueNumTargets } from '@helpers/hero/skill';
import { rngChoiceWeighted, rngSucceedsChance } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatOrderPick,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
} from '@interfaces';

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

  const skills = combatAvailableSkillsForCombatant(combatant).filter(
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
    combatOrderPick?.skill ??
    rngChoiceWeighted(skills, (skill) => combatant.skillWeights[skill.id] ?? 1);
  if (!chosenSkill) return false;

  combatantMarkSkillUse(combatant, chosenSkill);
  combatantSkillCastEventEmit(
    combatant.id,
    chosenSkill.name,
    chosenSkill.sprite,
  );

  if (chosenSkill.delay > 0) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(combatant)}** begins charging **${chosenSkill.name}**!`,
    );
    combatantQueueDelayedSkill(combatant, chosenSkill, combatOrderPick);
    return true;
  }

  combatantUseSkill(combat, combatant, chosenSkill, combatOrderPick);
  return true;
}

function combatTechniqueMisses(
  combatant: Combatant,
  tech: EquipmentSkillContentTechnique,
): boolean {
  if (techniqueHasAttribute(tech, 'NeverMisses')) return false;
  if (combatCombatantCombatStatSucceedsChance(combatant, 'missChance')) {
    return true;
  }

  return tech.accuracy < 100 && !rngSucceedsChance(tech.accuracy);
}

function combatantUseSkill(
  combat: Combat,
  combatant: Combatant,
  chosenSkill: EquipmentSkill,
  combatOrderPick?: CombatOrderPick,
): void {
  const capturedCreatorStats = { ...combatant.totalStats };

  chosenSkill.techniques.forEach((tech) => {
    const redirected = combatCombatantCombatStatSucceedsChance(
      combatant,
      'redirectionChance',
    );
    const baseTargetList = combatGetPossibleCombatantTargetsForSkillTechnique(
      combat,
      combatant,
      chosenSkill,
      tech,
      redirected,
    );

    const numTargets = skillTechniqueNumTargets(chosenSkill, tech);

    // A Combat Order's targetMode is an explicit override - it wins outright rather than
    // joining the combatant's own priority list. Confusion drops it, since it was aimed at the other side.
    const targetPriority =
      combatOrderPick?.targetMode && !redirected
        ? [{ type: combatOrderPick.targetMode }]
        : combatant.targetting;

    const targets = combatGetTargetsFromPriorityList(
      baseTargetList,
      targetPriority,
      numTargets,
      {
        combatant,
        targetCharacterId: combatOrderPick?.targetCharacterId,
        matchingCombatants: combatOrderPick?.matchingCombatants,
      },
    );

    targets.forEach((target) => {
      if (isCombatOver(combat)) return;

      if (combatTechniqueMisses(combatant, tech)) {
        combatMessageLog(
          combat,
          `**${combatantMessageToken(combatant)}**'s **${chosenSkill.name}** misses **${combatantMessageToken(target)}**!`,
        );
        combatantDamageEventEmit(target.id, 0, 'miss');
        return;
      }

      combatApplySkillToTarget(
        combat,
        combatant,
        target,
        chosenSkill,
        tech,
        capturedCreatorStats,
      );

      const shouldApplyAgain =
        !tech.summonMonsterId &&
        combatCombatantCombatStatSucceedsChance(
          combatant,
          'skillStrikeAgainChance',
        );

      if (shouldApplyAgain && !combatantIsDead(target)) {
        combatMessageLog(combat, `**${chosenSkill.name}** strikes again!`);

        combatApplySkillToTarget(
          combat,
          combatant,
          target,
          chosenSkill,
          tech,
          capturedCreatorStats,
        );
      }
    });
  });
}

// A ready batch stops once the caster dies mid-batch (e.g. from reflect).
function combatantFireDelayedSkills(
  combat: Combat,
  combatant: Combatant,
): boolean {
  const ready = combatantAdvanceDelayedSkills(combatant);

  ready.forEach((entry) => {
    if (isCombatOver(combat) || combatantIsDead(combatant)) return;

    const { skill } = entry;
    combatantSkillCastEventEmit(combatant.id, skill.name, skill.sprite);
    combatMessageLog(
      combat,
      `**${combatantMessageToken(combatant)}** unleashes **${skill.name}**!`,
    );
    combatantUseSkill(combat, combatant, skill, entry);
  });

  return ready.length > 0;
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

export function combatDoCombatIteration(): void {
  const current = worldCombatState();
  if (!current) return;

  if (combatCheckIfOver(current)) return;

  // The engine mutates combatants in place and committed state is frozen, so each round works on its own copy.
  const combat = structuredClone(current);

  beginCombatLogCommits();

  combatMessageLog(combat, `_Combat round ${combat.rounds + 1}._`);

  const turnOrder = orderCombatantsByAgility(combat);
  turnOrder.forEach((char) => {
    // A summon replaced earlier this round no longer acts.
    if (!combatHasCombatant(combat, char)) return;

    const res = combatantTakeTurn(combat, char);

    if (res?.takeAnotherTurn) {
      combatMessageLog(
        combat,
        `**${combatantMessageToken(char)}** was blessed by the elements, and gets to go again!`,
      );
      combatantTakeTurn(combat, char);
    }
  });

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

  updateGamestate((state) => {
    state.world.combat = combat;
    return state;
  });

  combatCheckIfOver(combat);

  endCombatLogCommits();
}
