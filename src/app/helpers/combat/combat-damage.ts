import {
  combatantIsDead,
  combatCombatantTakeDamage,
} from '@helpers/combat/combat-combatant-hp';
import {
  combatDealTechniqueDamage,
  combatReflectedDamage,
  techniqueHasAttribute,
} from '@helpers/combat/combat-damage-amount';
import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import {
  combatTechniqueElements,
  elementalDamageText,
} from '@helpers/combat/combat-element';
import {
  combatantMessageToken,
  combatantStatusText,
  combatFormatMessage,
  combatMessageLog,
} from '@helpers/combat/combat-log';
import { combatTryApplyTechniqueStatusEffect } from '@helpers/combat/combat-statuseffects-technique';
import { combatSummonMonster } from '@helpers/combat/combat-summon';
import { luckRollSucceeds } from '@helpers/hero/luck';
import {
  skillTechniqueDamageScalingStat,
  skillTechniqueWithStatBonuses,
} from '@helpers/hero/skill';
import { runStatsRecordHit } from '@helpers/run-stats/run-stats-combat';
import type {
  Combat,
  Combatant,
  CombatTechniqueDamage,
  CombatTechniqueOutcome,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  GameElement,
  GameStat,
  StatBlock,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

export function combatDamageElements(
  attacker: Combatant,
  technique: EquipmentSkillContentTechnique,
): GameElement[] {
  const dealsDamage =
    techniqueHasAttribute(technique, 'DamagesTarget') &&
    !techniqueHasAttribute(technique, 'HealsTarget') &&
    !techniqueHasAttribute(technique, 'RestoresTargetEnergy');
  return dealsDamage ? combatTechniqueElements(attacker, technique) : [];
}

export function getCombatantBaseStatDamageForTechnique(
  combatant: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
  stat: GameStat,
): number {
  const baseCheckMultiplier = technique.damageScaling[stat] ?? 0;
  if (baseCheckMultiplier === 0) return 0;

  const baseMultiplier = skillTechniqueDamageScalingStat(
    skill,
    technique,
    stat,
  );

  return combatant.totalStats[stat] * baseMultiplier;
}

// Defense weighting stays on the base technique, so a bonus adds damage without changing which defense applies.
export function getCombatantBaseDamageForTechnique(
  combatant: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): number {
  const scaled = skillTechniqueWithStatBonuses(
    skill,
    technique,
    combatant.skillStatBonuses,
  );

  return sum(
    (Object.keys(scaled.damageScaling) as GameStat[]).map((stat) =>
      getCombatantBaseStatDamageForTechnique(combatant, skill, scaled, stat),
    ),
  );
}

// Scales off the target's own stats, and a recast tops the shield up rather than stacking it.
function combatShieldTarget(
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): number {
  const before = target.shield ?? 0;
  const shield = Math.floor(
    getCombatantBaseDamageForTechnique(target, skill, technique),
  );
  target.shield = Math.max(before, shield);

  const gained = target.shield - before;
  if (gained > 0) combatantDamageEventEmit(target.id, gained, 'shield');
  return gained;
}

function combatTargetDodges(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): boolean {
  if (
    !techniqueHasAttribute(technique, 'AllowLuckDodge') ||
    !luckRollSucceeds(target.totalStats.Luck)
  ) {
    return false;
  }

  combatMessageLog(
    combat,
    `**${combatantMessageToken(target)}** dodges **${combatantMessageToken(combatant)}**'s **${skill.name}**!`,
    target,
  );
  combatantDamageEventEmit(target.id, 0, 'miss');
  return true;
}

function combatTechniqueHit(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
): CombatTechniqueOutcome {
  const baseDamage = getCombatantBaseDamageForTechnique(
    combatant,
    skill,
    technique,
  );
  const elements = combatDamageElements(combatant, technique);
  const isCriticalHit =
    baseDamage > 0 &&
    techniqueHasAttribute(technique, 'DamagesTarget') &&
    luckRollSucceeds(combatant.totalStats.Luck);

  let damage = 0;
  let retaliationDamage = 0;
  let applied: CombatTechniqueDamage | undefined;
  if (techniqueHasAttribute(technique, 'ShieldsTarget')) {
    damage = combatShieldTarget(target, skill, technique);
  } else if (baseDamage > 0) {
    applied = combatDealTechniqueDamage(
      combat,
      combatant,
      target,
      technique,
      baseDamage,
      elements,
      isCriticalHit,
    );
    damage = applied.dealt;
    retaliationDamage = combatReflectedDamage(target, technique, damage);
  }

  const summon = technique.summonMonsterId
    ? combatSummonMonster(combat, combatant, technique.summonMonsterId)
    : undefined;

  return {
    damage,
    damageText: elementalDamageText(damage, elements),
    isCriticalHit,
    retaliationDamage,
    summon,
    hpChange: applied?.hpChange,
    prevented: applied?.prevented ?? 0,
  };
}

function combatLogTechniqueMessage(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
  outcome: CombatTechniqueOutcome,
): void {
  if (!technique.combatMessage) return;

  const message = combatFormatMessage(technique.combatMessage, {
    combat,
    skill,
    technique,
    damage: outcome.damage,
    absdamage: Math.abs(outcome.damage),
    damageText: outcome.damageText,
    combatant: { ...combatant, name: combatantMessageToken(combatant) },
    target: { ...target, name: combatantMessageToken(target) },
    summon: outcome.summon
      ? { ...outcome.summon, name: combatantMessageToken(outcome.summon) }
      : undefined,
    combatantStatus: combatantStatusText(combatant),
    targetStatus: combatantStatusText(target),
  });
  const critSuffix = outcome.isCriticalHit ? ' **Critical hit (2x)!**' : '';
  combatMessageLog(combat, `${message}${critSuffix}`, target);
}

// The reflecting target is the source, so it's credited with the damage and any kill.
function combatApplyRetaliation(
  combat: Combat,
  combatant: Combatant,
  source: Combatant,
  damage: number,
): void {
  if (damage <= 0) return;

  const change = combatCombatantTakeDamage(combatant, damage);
  runStatsRecordHit(combat, source, combatant, { change });
  combatMessageLog(
    combat,
    `**${combatantMessageToken(combatant)}** took ${damage} damage in retaliation ${combatantStatusText(combatant)}!`,
    combatant,
  );
}

export function combatApplySkillToTarget(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
  capturedCreatorStats?: StatBlock,
): void {
  if (combatTargetDodges(combat, combatant, target, skill, technique)) return;

  const outcome = combatTechniqueHit(
    combat,
    combatant,
    target,
    skill,
    technique,
  );
  combatLogTechniqueMessage(
    combat,
    combatant,
    target,
    skill,
    technique,
    outcome,
  );
  if (outcome.hpChange) {
    runStatsRecordHit(combat, combatant, target, {
      change: outcome.hpChange,
      prevented: outcome.prevented,
      skillFamily: skill.family,
      isCriticalHit: outcome.isCriticalHit && outcome.hpChange.hpDelta > 0,
    });
  }
  combatApplyRetaliation(combat, combatant, target, outcome.retaliationDamage);

  (technique.statusEffects || []).forEach((application) =>
    combatTryApplyTechniqueStatusEffect(
      combat,
      combatant,
      target,
      skill,
      application,
      capturedCreatorStats,
    ),
  );

  if (combatantIsDead(target)) {
    combatMessageLog(
      combat,
      `**${combatantMessageToken(target)}** has been defeated!`,
    );
  }
}
