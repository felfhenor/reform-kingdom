import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import { combatantClearDelayedSkills } from '@helpers/combat/combat-skill-delay';
import type {
  CombatHpChange,
  Combatant,
  DamageEventVariant,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function combatantIsDead(combatant: Combatant): boolean {
  return combatant.hp <= 0;
}

export function combatantHealthPercent(combatant: Combatant): number {
  if (combatant.totalStats.Health <= 0) return 0;
  return (combatant.hp / combatant.totalStats.Health) * 100;
}

// Reports the real HP change so callers that know the attacker can credit it; this stays combat-agnostic.
export function combatCombatantTakeDamage(
  combatant: Combatant,
  damage: number,
  variant?: DamageEventVariant,
): CombatHpChange {
  const absorbed = combatantShieldAbsorb(combatant, damage);
  const hpDamage = damage - absorbed;
  if (damage > 0 && hpDamage === 0) {
    return { hpDelta: 0, absorbed, died: false };
  }

  const hpBefore = combatant.hp;
  combatant.hp = clamp(combatant.hp - hpDamage, 0, combatant.totalStats.Health);
  if (combatantIsDead(combatant)) combatantClearDelayedSkills(combatant);

  // Sign flipped so positive damage shows as "-".
  if (hpDamage !== 0) {
    combatantDamageEventEmit(
      combatant.id,
      -hpDamage,
      hpDamage > 0 ? variant : undefined,
    );
  }

  return {
    hpDelta: hpBefore - combatant.hp,
    absorbed,
    died: hpBefore > 0 && combatantIsDead(combatant),
  };
}

// The shield drains first; whatever it can't hold bleeds through to HP.
function combatantShieldAbsorb(combatant: Combatant, damage: number): number {
  const absorbed = damage > 0 ? Math.min(combatant.shield ?? 0, damage) : 0;
  if (absorbed === 0) return 0;

  combatant.shield = (combatant.shield ?? 0) - absorbed;
  combatantDamageEventEmit(combatant.id, -absorbed, 'shield');
  return absorbed;
}

export function combatCombatantTakeEnergyDamage(
  combatant: Combatant,
  damage: number,
) {
  combatant.ep = clamp(combatant.ep - damage, 0, combatant.totalStats.Energy);

  if (damage !== 0) {
    combatantDamageEventEmit(combatant.id, -damage, 'energy');
  }
}
