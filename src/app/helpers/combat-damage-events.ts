import { signal } from '@angular/core';
import { rngUuid } from '@helpers/rng';
import type { CombatantDamageEvent } from '@interfaces';

// Pushed by `combatCombatantTakeDamage` on any HP change - drained by the
// status card component to show a floating +/- number.
export const combatantDamageEvents = signal<CombatantDamageEvent[]>([]);

export function combatantDamageEventEmit(
  combatantId: string,
  amount: number,
): void {
  combatantDamageEvents.update((events) => [
    ...events,
    { id: rngUuid(), combatantId, amount },
  ]);
}

export function combatantDamageEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  combatantDamageEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
