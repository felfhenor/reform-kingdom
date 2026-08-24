import { combatCreateForEncounter } from '@helpers/combat/combat-create';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/hero/party';
import { rngNumberRange } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import type {
  Combat,
  EncounterContent,
  EncounterId,
  MonsterContent,
} from '@interfaces';

export function encounterStartFight(
  encounterId: EncounterId,
  fightIndex: number,
  locationName: string,
): void {
  const encounter = getEntry<EncounterContent>(encounterId);
  if (!encounter) return;

  const fight = encounter.fights[fightIndex];
  if (!fight) return;

  const monsters = fight.monsters
    .map((entry) => getEntry<MonsterContent>(entry.monsterId))
    .filter((monster): monster is MonsterContent => !!monster);

  const encounterLevel = rngNumberRange(
    encounter.levelRange.min,
    encounter.levelRange.max + 1,
  );

  const combat: Combat = {
    ...combatCreateForEncounter(
      partyGet(),
      monsters,
      encounterLevel,
      locationName,
    ),
    encounterId,
    fightIndex,
  };

  combatMessageLog(combat, `Encountering monster group #${fightIndex + 1}...`);

  updateGamestate((state) => {
    state.world.combat = combat;
    return state;
  });
}
