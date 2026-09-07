import { signal } from '@angular/core';
import { rngUuid } from '@helpers/rng';
import type { CombatantDamageEvent } from '@interfaces';

// Drained by the status card component to show a floating +/- number.
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
