import {
  combatantHealthPercent,
  combatantIsDead,
} from '@helpers/combat/combat-combatant-hp';
import { techniqueHasAttribute } from '@helpers/combat/combat-damage';
import { combatCanTakeTurn } from '@helpers/combat/combat-statuseffects';
import type { Combatant, EquipmentSkillContentTechnique } from '@interfaces';

function combatCoverCandidates(
  attacker: Combatant,
  target: Combatant,
  validTargets: Combatant[],
): Combatant[] {
  const targetHealthPercent = combatantHealthPercent(target);

  return validTargets.filter(
    (ally) =>
      ally.isEnemy === target.isEnemy &&
      ally !== target &&
      ally !== attacker &&
      !combatantIsDead(ally) &&
      combatCanTakeTurn(ally) &&
      (ally.combatStats.coverThreshold ?? 0) > targetHealthPercent,
  );
}

// Only allies the technique could have hit may cover, and a taunting target keeps the hit it drew.
export function combatCoveringAlly(
  attacker: Combatant,
  target: Combatant,
  validTargets: Combatant[],
  technique: EquipmentSkillContentTechnique,
  numTargets: number,
): Combatant | undefined {
  if (numTargets !== 1 || target === attacker) return undefined;
  if (target.combatStats.agroValue > 0) return undefined;
  if (!techniqueHasAttribute(technique, 'DamagesTarget')) return undefined;

  return combatCoverCandidates(attacker, target, validTargets)[0];
}
