import { combatRollAmbush } from '@helpers/combat/combat-ambush';
import {
  combatantsFromTownGuardians,
  combatCreateForEncounter,
} from '@helpers/combat/combat-create';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { canPartyTravel } from '@helpers/hero/travel';
import {
  updateGamestate,
  worldPartyState,
  worldTownsState,
} from '@helpers/state-game';
import { townGuardiansForCurrentReputation } from '@helpers/town/town-guardian';
import { isPartyAtNode } from '@helpers/world';
import type { Combat, MonsterContent, TownContent, TownId } from '@interfaces';

// Deaths Door/Healing block it too, else a retry right after a wipe starts a fight at 0 HP.
export function raidCanEngage(town: TownContent): boolean {
  const expiresAtTick =
    worldTownsState()[town.id]?.raidEngageWindowExpiresAtTick;
  // The loss lands on the next raid check, so an expired window must not be engageable in the gap.
  return (
    expiresAtTick !== undefined &&
    timerTicksElapsed() < expiresAtTick &&
    canPartyTravel() &&
    isPartyAtNode(town.name)
  );
}

// Real engage path (manual button or DefendTowns). The telegraph stays up so a lost fight can be retried until it expires.
export function raidEngageCombat(townId: TownId): boolean {
  const town = getEntry<TownContent>(townId);
  if (!town || !raidCanEngage(town)) return false;

  const state = worldTownsState()[townId];

  // The list rolled at telegraph time - must match what the Raid tab preview showed.
  const enemies = (state.raidTelegraphedAssaulterIds ?? [])
    .map((monsterId) => getEntry<MonsterContent>(monsterId))
    .filter((monster): monster is MonsterContent => !!monster);
  if (enemies.length === 0) return false;

  const helpers = combatantsFromTownGuardians(
    townGuardiansForCurrentReputation(town),
    town.level,
  );

  const combat: Combat = {
    ...combatCreateForEncounter(
      worldPartyState(),
      enemies,
      town.defense.assaulter.level.max,
      town.name,
      helpers,
    ),
    raidTownId: townId,
    ambushedBy: combatRollAmbush(),
  };

  combatMessageLog(combat, `The raid on ${town.name} begins!`);
  analyticsSendDesignEvent(
    `Town:Raid:Engage:${analyticsSafeSegment(town.name)}`,
  );

  updateGamestate((gs) => {
    gs.world.combat = combat;
    return gs;
  });

  return true;
}
