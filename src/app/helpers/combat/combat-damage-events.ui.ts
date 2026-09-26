import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { clamp } from 'es-toolkit/compat';

// Bigger hits (relative to the target's max HP) get bigger numbers; heals stay at 1x.
export function damageNumberScale(amount: number, maxHp: number): number {
  if (amount >= 0 || maxHp <= 0) return 1;

  return clamp(0.9 + (Math.abs(amount) / maxHp) * 2.5, 0.9, 1.6);
}

export function combatantDamageEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  combatantDamageEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
