import {
  combatantsFromTownGuardians,
  combatCreateForEncounter,
} from '@helpers/combat/combat-create';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { currentCombat } from '@helpers/combat/combat-state';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { partyGet } from '@helpers/hero/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidDefenseGlobalEffectApply } from '@helpers/town/raid/town-raid-defense';
import { townGuardiansForCurrentReputation } from '@helpers/town/town-guardian';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type { Combat, MonsterContent, TownContent, TownId } from '@interfaces';

// Mirrors how every other standing-at-a-node action (shop, craft, workers) is gated in the UI.
function partyIsAtTown(town: TownContent): boolean {
  return worldNodeAtCurrentLocation()?.nodeName === town.name;
}

// Real engage path (manual button or DefendTowns) - see debugStartTownDefenseCombat for testing.
export function raidEngageCombat(townId: TownId): boolean {
  const town = getEntry<TownContent>(townId);
  if (!town) return false;
  if (currentCombat()) return false;

  const state = gamestate().world.towns[townId];
  if (state?.raidTelegraphedAtTick === undefined) return false;
  if (!partyIsAtTown(town)) return false;

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
      partyGet(),
      enemies,
      town.defense.assaulter.level.max,
      town.name,
      helpers,
    ),
    raidTownId: townId,
  };

  combatMessageLog(combat, `The raid on ${town.name} begins!`);
  analyticsSendDesignEvent(
    `Town:Raid:Engage:${analyticsSafeSegment(town.name)}`,
  );

  updateGamestate((gs) => {
    gs.world.combat = combat;
    const target = gs.world.towns[townId];
    if (target) {
      target.raidTelegraphedAtTick = undefined;
      target.raidEngageWindowExpiresAtTick = undefined;
      target.raidTelegraphedAssaulterIds = undefined;
    }
    raidDefenseGlobalEffectApply(gs, timerTicksElapsed());
    return gs;
  });

  return true;
}
