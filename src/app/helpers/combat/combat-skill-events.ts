import { signal } from '@angular/core';
import { rngUuid } from '@helpers/rng';
import type { CombatantSkillCastEvent } from '@interfaces';

// Pushed once a combatant resolves their turn's skill - drained by the
// status card component to flash the skill's icon and name.
export const combatantSkillCastEvents = signal<CombatantSkillCastEvent[]>([]);

export function combatantSkillCastEventEmit(
  combatantId: string,
  skillName: string,
  skillSprite: string,
): void {
  combatantSkillCastEvents.update((events) => [
    ...events,
    { id: rngUuid(), combatantId, skillName, skillSprite },
  ]);
}

export function combatantSkillCastEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  combatantSkillCastEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
