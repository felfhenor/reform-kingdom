import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import type { Combatant, DamageEventVariant } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function combatantIsDead(combatant: Combatant): boolean {
  return combatant.hp <= 0;
}

export function combatCombatantTakeDamage(
  combatant: Combatant,
  damage: number,
  variant?: DamageEventVariant,
) {
  combatant.hp = clamp(combatant.hp - damage, 0, combatant.totalStats.Health);

  // Sign flipped so positive damage shows as "-".
  if (damage !== 0) {
    combatantDamageEventEmit(
      combatant.id,
      -damage,
      damage > 0 ? variant : undefined,
    );
  }
}
