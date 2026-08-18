import { signal } from '@angular/core';
import { rngUuid } from '@helpers/rng';
import type { HeroDamageEvent } from '@interfaces';

// Pushed to whenever a hero combatant's HP changes (damage or healing) via
// `combatCombatantTakeDamage` - drained by the hero status bar component to
// show a floating +/- number above whichever hero was hit or healed.
export const heroDamageEvents = signal<HeroDamageEvent[]>([]);

export function heroDamageEventEmit(characterId: string, amount: number): void {
  heroDamageEvents.update((events) => [
    ...events,
    { id: rngUuid(), characterId, amount },
  ]);
}

export function heroDamageEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  heroDamageEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
