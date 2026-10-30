import { combatRollAmbush } from '@helpers/combat/combat-ambush';
import { combatCreateForEncounter } from '@helpers/combat/combat-create';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { rngNumberRange } from '@helpers/rng';
import { updateGamestate, worldPartyState } from '@helpers/state-game';
import type {
  Combat,
  EncounterContent,
  EncounterId,
  MonsterContent,
} from '@interfaces';

// Shared by a real fight and an auto-win, so both build the same monsters at the same rolled level.
export function encounterCreateFightCombat(
  encounterId: EncounterId,
  fightIndex: number,
  locationName: string,
): Combat | undefined {
  const encounter = getEntry<EncounterContent>(encounterId);
  if (!encounter) return undefined;

  const fight = encounter.fights[fightIndex];
  if (!fight) return undefined;

  const monsters = fight.monsters
    .map((entry) => getEntry<MonsterContent>(entry.monsterId))
    .filter((monster): monster is MonsterContent => !!monster);

  const encounterLevel = rngNumberRange(
    encounter.levelRange.min,
    encounter.levelRange.max,
  );

  return {
    ...combatCreateForEncounter(
      worldPartyState(),
      monsters,
      encounterLevel,
      locationName,
    ),
    encounterId,
    fightIndex,
  };
}

export function encounterStartFight(
  encounterId: EncounterId,
  fightIndex: number,
  locationName: string,
  heldXp: number[] = [],
): void {
  const created = encounterCreateFightCombat(
    encounterId,
    fightIndex,
    locationName,
  );
  if (!created) return;

  // Rolled per real fight only - auto-wins never fight.
  const combat: Combat = {
    ...created,
    heldXp,
    ambushedBy: combatRollAmbush(),
  };

  combatMessageLog(combat, `Encountering monster group #${fightIndex + 1}...`);

  updateGamestate((state) => {
    state.world.combat = combat;
    return state;
  });
}
