import { combatAnalyzeTarget } from '@helpers/combat/combat-analyze';
import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { combatCoveringAlly } from '@helpers/combat/combat-cover';
import { combatApplySkillToTarget } from '@helpers/combat/combat-damage';
import { techniqueHasAttribute } from '@helpers/combat/combat-damage-amount';
import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import { isCombatOver } from '@helpers/combat/combat-end';
import {
  combatantMessageToken,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { combatantAdvanceDelayedSkills } from '@helpers/combat/combat-skill-delay';
import { combatFillSkillElements } from '@helpers/combat/combat-skill-elements';
import { combatantSkillCastEventEmit } from '@helpers/combat/combat-skill-events';
import { combatCombatantCombatStatSucceedsChance } from '@helpers/combat/combat-stats';
import {
  combatGetPossibleCombatantTargetsForSkillTechnique,
  combatGetTargetsForTechnique,
} from '@helpers/combat/combat-targetting';
import { getEntry } from '@helpers/content/content';
import { skillTechniqueNumTargets } from '@helpers/hero/skill';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatOrderPick,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
} from '@interfaces';

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

export function combatantUseSkill(
  combat: Combat,
  combatant: Combatant,
  chosenSkill: EquipmentSkill,
  combatOrderPick?: CombatOrderPick,
): void {
  combatFillSkillElements(combat, chosenSkill);

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
    const appliedSkill = tech.echoOf
      ? (getEntry<EquipmentSkill>(tech.echoOf) ?? chosenSkill)
      : chosenSkill;

    // A Combat Order's targetMode is an explicit override - it wins outright rather than
    // joining the combatant's own priority list. Confusion drops it, since it was aimed at the other side.
    const targetPriority =
      combatOrderPick?.targetMode && !redirected && !tech.echoOf
        ? [{ type: combatOrderPick.targetMode }]
        : combatant.targetting;

    const targets = combatGetTargetsForTechnique(
      combat,
      baseTargetList,
      tech,
      targetPriority,
      numTargets,
      {
        combatant,
        targetCharacterId: combatOrderPick?.targetCharacterId,
        matchingCombatants: combatOrderPick?.matchingCombatants,
      },
    );

    targets.forEach((intendedTarget) => {
      if (isCombatOver(combat)) return;

      const cover = combatCoveringAlly(
        combatant,
        intendedTarget,
        baseTargetList,
        tech,
        numTargets,
      );
      if (cover) {
        combatMessageLog(
          combat,
          `**${combatantMessageToken(cover)}** covers **${combatantMessageToken(intendedTarget)}**!`,
          cover,
        );
      }

      const target = cover ?? intendedTarget;

      if (combatTechniqueMisses(combatant, tech)) {
        combatMessageLog(
          combat,
          `**${combatantMessageToken(combatant)}**'s **${chosenSkill.name}** misses **${combatantMessageToken(target)}**!`,
        );
        combatantDamageEventEmit(target.id, 0, 'miss');
        combatAnalyzeTarget(combat, combatant, target, tech);
        return;
      }

      combatApplySkillToTarget(
        combat,
        combatant,
        target,
        appliedSkill,
        tech,
        capturedCreatorStats,
      );
      combatAnalyzeTarget(combat, combatant, target, tech);

      const shouldApplyAgain =
        !tech.summonMonsterId &&
        combatCombatantCombatStatSucceedsChance(
          combatant,
          'skillStrikeAgainChance',
        );

      if (shouldApplyAgain && !combatantIsDead(target)) {
        combatMessageLog(combat, `**${appliedSkill.name}** strikes again!`);

        combatApplySkillToTarget(
          combat,
          combatant,
          target,
          appliedSkill,
          tech,
          capturedCreatorStats,
        );
      }
    });
  });
}

// A ready batch stops once the caster dies mid-batch (e.g. from reflect).
export function combatantFireDelayedSkills(
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
