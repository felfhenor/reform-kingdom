import { signal } from '@angular/core';
import {
  combatEventKey,
  combatEventsMuted,
} from '@helpers/combat/combat-event-scope';
import { isPageVisible } from '@helpers/engine/page-visibility';
import { rngUuid } from '@helpers/rng';
import type { CombatantDamageEvent, DamageEventVariant } from '@interfaces';

// Drained by the status card component to show a floating +/- number.
export const combatantDamageEvents = signal<CombatantDamageEvent[]>([]);

export function combatantDamageEventEmit(
  combatantId: string,
  amount: number,
  variant?: DamageEventVariant,
): void {
  if (!isPageVisible() || combatEventsMuted()) return;

  combatantDamageEvents.update((events) => [
    ...events,
    {
      id: rngUuid(),
      combatantId: combatEventKey(combatantId),
      amount,
      variant,
    },
  ]);
}
