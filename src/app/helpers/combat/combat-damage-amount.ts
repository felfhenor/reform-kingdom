import {
  combatCombatantTakeDamage,
  combatCombatantTakeEnergyDamage,
} from '@helpers/combat/combat-combatant-hp';
import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import { combatDamageMitigationRoll } from '@helpers/combat/combat-damage-mitigation';
import { elementalDamageMultiplier } from '@helpers/combat/combat-element';
import { combatCombatantCombatStatValue } from '@helpers/combat/combat-stats';
import { getEntry } from '@helpers/content/content';
import type {
  Combat,
  Combatant,
  EquipmentSkillAttribute,
  EquipmentSkillContentTechnique,
  GameElement,
  MonsterContent,
} from '@interfaces';
import { MagicalStats, PhysicalStats } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function techniqueHasAttribute(
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

function getDeadlockPreventionDamageMultiplier(rounds: number): number {
  const multiplierTiers = Math.floor(rounds / 25);
  return 1 + 0.25 * multiplierTiers;
}

// Sums the attacker's MonsterTypeDamage bonuses across every type the target's monster content carries - 0 for non-monster targets or monsters attacking.
function attackerMonsterTypeDamageBonusPercent(
  attacker: Combatant,
  target: Combatant,
): number {
  if (!target.monsterId || !attacker.monsterTypeDamageBonus) return 0;

  const monster = getEntry<MonsterContent>(target.monsterId);
  if (!monster) return 0;

  return sumBy(
    monster.types,
    (type) => attacker.monsterTypeDamageBonus?.[type] ?? 0,
  );
}

// Heals and energy restores turn negative, capped at what the target is missing.
function combatRestorativeAmount(
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  baseDamage: number,
): number {
  let amount = baseDamage;

  if (techniqueHasAttribute(technique, 'HealsTarget')) {
    const reduction = combatCombatantCombatStatValue(
      target,
      'healingIgnorePercent',
    );
    amount *= 1 - reduction / 100;
    amount = -Math.abs(Math.min(amount, target.totalStats.Health - target.hp));
  }

  if (techniqueHasAttribute(technique, 'RestoresTargetEnergy')) {
    amount = -Math.min(amount, target.totalStats.Energy - target.ep);
  }

  return amount;
}

// Elements apply before plink, so plink still guarantees 1 through heavy resistance.
function combatMitigateDamage(
  combatant: Combatant,
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  damage: number,
  elements: GameElement[],
): number {
  let mitigated = damage;

  if (!techniqueHasAttribute(technique, 'BypassDefense')) {
    const rolledDefense = combatDamageMitigationRoll(
      targetDefenseValue(target, technique),
      target.totalStats.Luck,
    );
    mitigated = Math.max(0, mitigated - rolledDefense);
  }

  mitigated *= elementalDamageMultiplier(combatant, target, elements);

  return techniqueHasAttribute(technique, 'AllowPlink')
    ? Math.max(1, mitigated)
    : mitigated;
}

function combatAmplifyDamage(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  damage: number,
  isCriticalHit: boolean,
): number {
  let amplified = isCriticalHit ? damage * 2 : damage;

  if (techniqueHasAttribute(technique, 'DamagesTarget')) {
    const bonusPercent = attackerMonsterTypeDamageBonusPercent(
      combatant,
      target,
    );
    if (bonusPercent !== 0) amplified *= 1 + bonusPercent / 100;
  }

  // Deadlock prevention escalates damage only, never healing.
  if (amplified > 0) {
    amplified *= getDeadlockPreventionDamageMultiplier(combat.rounds);
  }

  return Math.floor(amplified);
}

// Returns what actually landed - an energy drain can't take more than the target has.
function combatApplyTechniqueDamage(
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  damage: number,
  isCriticalHit: boolean,
): number {
  let dealt = damage;

  if (techniqueHasAttribute(technique, 'RestoresTargetEnergy')) {
    combatCombatantTakeEnergyDamage(target, dealt);
  } else if (techniqueHasAttribute(technique, 'DrainsTargetEnergy')) {
    dealt = Math.min(dealt, target.ep);
    combatCombatantTakeEnergyDamage(target, dealt);
  } else {
    combatCombatantTakeDamage(
      target,
      dealt,
      isCriticalHit ? 'critical' : undefined,
    );
  }

  if (dealt === 0 && techniqueHasAttribute(technique, 'DamagesTarget')) {
    combatantDamageEventEmit(target.id, 0, 'block');
  }

  return dealt;
}

export function combatReflectedDamage(
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  damage: number,
): number {
  const reflectPercent = combatCombatantCombatStatValue(
    target,
    'damageReflectPercent',
  );
  if (
    damage <= 0 ||
    reflectPercent <= 0 ||
    !techniqueHasAttribute(technique, 'CanBeReflected')
  ) {
    return 0;
  }

  return Math.floor((damage * reflectPercent) / 100);
}

export function combatDealTechniqueDamage(
  combat: Combat,
  combatant: Combatant,
  target: Combatant,
  technique: EquipmentSkillContentTechnique,
  baseDamage: number,
  elements: GameElement[],
  isCriticalHit: boolean,
): number {
  const restorative = combatRestorativeAmount(target, technique, baseDamage);
  const mitigated = combatMitigateDamage(
    combatant,
    target,
    technique,
    restorative,
    elements,
  );
  const amplified = combatAmplifyDamage(
    combat,
    combatant,
    target,
    technique,
    mitigated,
    isCriticalHit,
  );
  return combatApplyTechniqueDamage(
    target,
    technique,
    amplified,
    isCriticalHit,
  );
}
