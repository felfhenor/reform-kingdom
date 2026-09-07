import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';

export function combatantDamageEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  combatantDamageEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
