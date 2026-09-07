import { combatantSkillCastEvents } from '@helpers/combat/combat-skill-events';

export function combatantSkillCastEventsClear(ids: string[]): void {
  const idSet = new Set(ids);
  combatantSkillCastEvents.update((events) =>
    events.filter((event) => !idSet.has(event.id)),
  );
}
