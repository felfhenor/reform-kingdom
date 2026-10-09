import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import { combatantFromMonster } from '@helpers/combat/combat-create';
import { getEntry } from '@helpers/content/content';
import type { Combat, Combatant, MonsterContent } from '@interfaces';

export function combatantHasLivingSummon(
  combat: Combat,
  combatant: Combatant,
): boolean {
  return [...combat.guardians, ...combat.helpers].some(
    (c) => c.summonerId === combatant.id && !combatantIsDead(c),
  );
}

export function combatHasCombatant(
  combat: Combat,
  combatant: Combatant,
): boolean {
  return [...combat.guardians, ...combat.heroes, ...combat.helpers].includes(
    combatant,
  );
}

// Replaces any previous summon of this summoner; hero-side summons join the helpers.
export function combatSummonMonster(
  combat: Combat,
  summoner: Combatant,
  monsterId: string,
): Combatant | undefined {
  const monster = getEntry<MonsterContent>(monsterId);
  if (!monster) return undefined;

  const side = summoner.isEnemy ? 'guardians' : 'helpers';
  const kept = combat[side].filter((c) => c.summonerId !== summoner.id);
  const summon: Combatant = {
    ...combatantFromMonster(monster, summoner.level, kept.length),
    isEnemy: summoner.isEnemy,
    summonerId: summoner.id,
  };

  combat[side] = [...kept, summon];
  return summon;
}
