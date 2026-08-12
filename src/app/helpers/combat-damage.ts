import { combatantIsDead } from '@helpers/combat-end';
import { combatFormatMessage, combatMessageLog } from '@helpers/combat-log';
import { combatCombatantCombatStatValue } from '@helpers/combat-stats';
import {
  combatApplyStatusEffectToTarget,
  combatCreateStatusEffect,
} from '@helpers/combat-statuseffects';
import { getEntry } from '@helpers/content';
import { luckReducedChance, luckRollSucceeds } from '@helpers/luck';
import { rngSucceedsChance } from '@helpers/rng';
import {
  skillTechniqueDamageScalingStat,
  skillTechniqueStatusEffectChance,
  skillTechniqueStatusEffectDuration,
} from '@helpers/skill';
import type {
  Combat,
  Combatant,
  EquipmentSkill,
  EquipmentSkillAttribute,
  EquipmentSkillContentTechnique,
  GameStat,
  StatBlock,
  StatusEffectContent,
} from '@interfaces';
import { MagicalStats, PhysicalStats } from '@interfaces';
import { clamp, sum, sumBy } from 'es-toolkit/compat';

function techniqueHasAttribute(
  technique: EquipmentSkillContentTechnique,
  attribute: EquipmentSkillAttribute,
): boolean {
  return technique.attributes?.includes(attribute);
}

function targetDefenseValue(
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
): number {
  const resistanceWeight = sumBy(
    MagicalStats,
    (stat) => technique.damageScaling[stat] ?? 0,
  );
  const vitalityWeight = sumBy(
    PhysicalStats,
    (stat) => technique.damageScaling[stat] ?? 0,
  );

  const totalWeight = resistanceWeight + vitalityWeight;
  if (totalWeight === 0) return 0;

  const resistancePercent = resistanceWeight / totalWeight;
  const vitalityPercent = vitalityWeight / totalWeight;

  return (
    resistancePercent * target.totalStats.Resistance +
    vitalityPercent * target.totalStats.Vitality
  );
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

  const affinityElementBoostMultiplier = sumBy(
    technique.elements,
    (el) => combatant.affinity[el],
  );

  const baseStatWithoutMultiplier = combatant.totalStats[stat];

  const totalMultiplier = baseMultiplier + affinityElementBoostMultiplier;

  return baseStatWithoutMultiplier * totalMultiplier;
}

function getDeadlockPreventionDamageMultiplier(rounds: number): number {
  const multiplierTiers = Math.floor(rounds / 25);
  return 1 + 0.25 * multiplierTiers;
}

export function combatCombatantTakeDamage(
  combatant: Combatant,
  damage: number,
) {
  combatant.hp = clamp(combatant.hp - damage, 0, combatant.totalStats.Health);
}

export function combatApplySkillToTarget(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  skill: EquipmentSkill,
  technique: EquipmentSkillContentTechnique,
  capturedCreatorStats?: StatBlock,
): void {
  if (
    techniqueHasAttribute(technique, 'AllowLuckDodge') &&
    luckRollSucceeds(target.totalStats.Luck)
  ) {
    combatMessageLog(
      combat,
      `**${target.name}** dodges **${combatant.name}**'s **${skill.name}**!`,
      target,
    );
    return;
  }

  const baseDamage = sum(
    (Object.keys(technique.damageScaling) as GameStat[]).map((stat) =>
      getCombatantBaseStatDamageForTechnique(combatant, skill, technique, stat),
    ),
  );

  const templateData = {
    combat,
    combatant,
    target,
    skill,
    technique,
    damage: 0,
    absdamage: 0,
  };

  let retaliationDamage = 0;

  const isCriticalHit =
    baseDamage > 0 &&
    techniqueHasAttribute(technique, 'DamagesTarget') &&
    luckRollSucceeds(combatant.totalStats.Luck);

  if (baseDamage > 0) {
    const targetDefense = targetDefenseValue(target, technique);

    let effectiveDamage = baseDamage;

    if (techniqueHasAttribute(technique, 'HealsTarget')) {
      effectiveDamage = Math.min(
        effectiveDamage,
        target.totalStats.Health - target.hp,
      );

      const reduction = combatCombatantCombatStatValue(
        target,
        'healingIgnorePercent',
      );
      effectiveDamage *= 1 - reduction;

      effectiveDamage = -Math.abs(effectiveDamage);
    }

    if (!techniqueHasAttribute(technique, 'BypassDefense')) {
      effectiveDamage = Math.max(0, effectiveDamage - targetDefense);
    }

    if (techniqueHasAttribute(technique, 'AllowPlink')) {
      effectiveDamage = Math.max(baseDamage > 0 ? 1 : 0, effectiveDamage);
    }

    if (isCriticalHit) {
      effectiveDamage *= 2;
    }

    // Apply deadlock prevention damage multiplier (only for damage, not healing)
    let deadlockPreventionMultiplier = 1;
    if (effectiveDamage > 0) {
      deadlockPreventionMultiplier = getDeadlockPreventionDamageMultiplier(
        combat.rounds,
      );
    }

    effectiveDamage *= deadlockPreventionMultiplier;
    effectiveDamage = Math.floor(effectiveDamage);

    combatCombatantTakeDamage(target, effectiveDamage);

    templateData.damage = effectiveDamage;
    templateData.absdamage = Math.abs(effectiveDamage);

    const damageReflectPercent = combatCombatantCombatStatValue(
      target,
      'damageReflectPercent',
    );
    if (effectiveDamage > 0 && damageReflectPercent > 0) {
      retaliationDamage = Math.floor(
        (effectiveDamage * damageReflectPercent) / 100,
      );
    }
  }

  if (technique.combatMessage) {
    const message = combatFormatMessage(technique.combatMessage, templateData);
    const critSuffix = isCriticalHit ? ' **Critical Hit!**' : '';
    combatMessageLog(combat, `${message}${critSuffix}`, target);
  }

  if (retaliationDamage > 0) {
    combatCombatantTakeDamage(combatant, retaliationDamage);

    combatMessageLog(
      combat,
      `**${combatant.name}** took ${retaliationDamage} damage in retaliation (${combatant.hp}/${combatant.totalStats.Health} HP remaining)!`,
      combatant,
    );
  }

  (technique.statusEffects || []).forEach((effData) => {
    const effectContent = getEntry<StatusEffectContent>(effData.statusEffectId);
    if (!effectContent) return;

    const totalChance = skillTechniqueStatusEffectChance(skill, effData);
    const resistedChance = luckReducedChance(
      totalChance,
      target.totalStats.Luck,
    );

    if (!rngSucceedsChance(resistedChance)) return;

    const statusEffect = combatCreateStatusEffect(
      effectContent,
      skill,
      combatant,
      target,
      {
        duration: skillTechniqueStatusEffectDuration(skill, effData),
      },
      capturedCreatorStats,
    );

    combatApplyStatusEffectToTarget(combat, target, statusEffect);
  });

  if (combatantIsDead(target)) {
    combatMessageLog(combat, `**${target.name}** has been defeated!`);
  }
}
