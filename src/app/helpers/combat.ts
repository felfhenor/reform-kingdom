import {
  combatApplySkillToTarget,
  combatCombatantTakeDamage,
} from '@helpers/combat-damage';
import {
  combatantIsDead,
  combatCheckIfOver,
  combatHandleDefeat,
  isCombatOver,
} from '@helpers/combat-end';
import {
  beginCombatLogCommits,
  combatMessageLog,
  endCombatLogCommits,
} from '@helpers/combat-log';
import {
  combatCanTakeTurn,
  combatHandleCombatantStatusEffects,
  combatUnapplyAllStatusEffects,
} from '@helpers/combat-statuseffects';
import {
  combatAvailableSkillsForCombatant,
  combatGetPossibleCombatantTargetsForSkill,
  combatGetPossibleCombatantTargetsForSkillTechnique,
  combatGetTargetsFromListBasedOnType,
} from '@helpers/combat-targetting';
import { gamestate, updateGamestate } from '@helpers/state-game';

import { sample, sortBy } from 'es-toolkit/compat';

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantCombatStatValue,
} from '@helpers/combat-stats';
import { rngSucceedsChance } from '@helpers/rng';
import { skillTechniqueNumTargets } from '@helpers/skill';
import type { Combat, Combatant, EquipmentSkill } from '@interfaces';

type CombatTurnResult = {
  takeAnotherTurn?: boolean;
};

export function currentCombat(): Combat | undefined {
  return gamestate().world.combat;
}

function orderCombatantsByAgility(combat: Combat): Combatant[] {
  return sortBy(
    [...combat.guardians, ...combat.heroes],
    (c) => -c.totalStats.Agility,
  );
}

function combatantMarkSkillUse(
  combatant: Combatant,
  skill: EquipmentSkill,
): void {
  const shouldApplyExtraUses = combatCombatantCombatStatSucceedsChance(
    combatant,
    'skillAdditionalUseChance',
  );

  const extraUses = shouldApplyExtraUses
    ? combatCombatantCombatStatValue(combatant, 'skillAdditionalUseCount')
    : 0;

  combatant.skillUses[skill.id] ??= 0;
  combatant.skillUses[skill.id] += 1 + extraUses;
}

function combatantTakeTurn(
  combat: Combat,
  combatant: Combatant,
): CombatTurnResult {
  if (combatantIsDead(combatant)) {
    if (rngSucceedsChance(combatant.combatStats.reviveChance)) {
      combatMessageLog(
        combat,
        `**${combatant.name}** has sprung to life!`,
        combatant,
      );

      combatCombatantTakeDamage(combatant, -combatant.totalStats.Health);

      combatUnapplyAllStatusEffects(combat, combatant);
    } else {
      combatMessageLog(combat, `**${combatant.name}** is dead, skipping turn.`);
      return {};
    }
  }

  combatHandleCombatantStatusEffects(combat, combatant, 'TurnStart');

  if (combatantIsDead(combatant)) {
    combatMessageLog(
      combat,
      `**${combatant.name}** has been defeated!`,
      combatant,
    );
    return {};
  }

  if (!combatCanTakeTurn(combatant)) {
    combatMessageLog(combat, `**${combatant.name}** lost their turn!`);
    return {};
  }

  const skills = combatAvailableSkillsForCombatant(combatant).filter(
    (s) =>
      combatGetPossibleCombatantTargetsForSkill(combat, combatant, s).length >
      0,
  );

  const chosenSkill = sample(skills);
  if (!chosenSkill) {
    combatMessageLog(
      combat,
      `**${combatant.name}** has no skills available, skipping turn.`,
    );
    return {};
  }

  combatantMarkSkillUse(combatant, chosenSkill);

  // Capture the creator's stats before any modifications from this skill
  const capturedCreatorStats = { ...combatant.totalStats };

  chosenSkill.techniques.forEach((tech) => {
    const baseTargetList = combatGetPossibleCombatantTargetsForSkillTechnique(
      combat,
      combatant,
      chosenSkill,
      tech,
    );

    const numTargets = skillTechniqueNumTargets(chosenSkill, tech);

    const targets = combatGetTargetsFromListBasedOnType(
      baseTargetList,
      combatant.targettingType,
      numTargets,
    );

    targets.forEach((target) => {
      // check for early termination of combat
      if (isCombatOver(combat)) return;

      const shouldMiss = combatCombatantCombatStatSucceedsChance(
        combatant,
        'missChance',
      );

      if (shouldMiss) {
        combatMessageLog(
          combat,
          `**${chosenSkill.name}** misses **${target.name}**!`,
        );
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

      const shouldApplyAgain = combatCombatantCombatStatSucceedsChance(
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

  combatHandleCombatantStatusEffects(combat, combatant, 'TurnEnd');

  if (combatantIsDead(combatant)) {
    combatMessageLog(
      combat,
      `**${combatant.name}** has been defeated!`,
      combatant,
    );
    return {};
  }

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
  const combat = currentCombat();
  if (!combat) return;

  if (combatCheckIfOver(combat)) return;

  beginCombatLogCommits();

  combatMessageLog(combat, `_Combat round ${combat.rounds + 1}._`);

  const turnOrder = orderCombatantsByAgility(combat);
  turnOrder.forEach((char) => {
    const res = combatantTakeTurn(combat, char);

    if (res?.takeAnotherTurn) {
      combatMessageLog(
        combat,
        `**${char.name}** was blessed by the elements, and gets to go again!`,
      );
      combatantTakeTurn(combat, char);
    }
  });

  updateGamestate((state) => {
    const previousRounds = combat.rounds;
    combat.rounds++;

    // Check if we've crossed into a new deadlock prevention tier
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

    state.world.combat = combat;
    return state;
  });

  combatCheckIfOver(combat);

  endCombatLogCommits();
}

export function combatHandleFlee(): void {
  const combat = currentCombat();
  if (!combat) return;

  combatMessageLog(combat, 'The heroes have fled!');
  combatHandleDefeat(combat);
  combatReset();
}

export function combatReset(): void {
  updateGamestate((state) => {
    state.world.combat = undefined;
    return state;
  });
}
