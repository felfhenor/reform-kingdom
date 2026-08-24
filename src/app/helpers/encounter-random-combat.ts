import { analyticsSendDesignEvent } from '@helpers/analytics';
import { combatCreateForEncounter } from '@helpers/combat-create';
import { combatMessageLog } from '@helpers/combat-log';
import { grantResolvedDrops } from '@helpers/combat-rewards';
import { getEntry } from '@helpers/content';
import { encounterRandomState } from '@helpers/encounter-random';
import { rollDroppedRewards } from '@helpers/loot';
import { partyGet } from '@helpers/party';
import { researchPointItemId } from '@helpers/research/research';
import { updateGamestate } from '@helpers/state-game';
import {
  isFirstTimeNodeRewardsGranted,
  markFirstTimeNodeRewardsGranted,
} from '@helpers/world-node-first-time-rewards';
import {
  worldNodeByName,
  worldNodeEncounterRandom,
} from '@helpers/world-nodes';
import type {
  Combat,
  EncounterRandomContent,
  EncounterRandomId,
  MonsterContent,
  ResolvedItemDrop,
  WorldNodeEntry,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function encounterRandomStartFight(
  entry: WorldNodeEntry,
  fightIndex: number,
): void {
  const content = worldNodeEncounterRandom(entry);
  if (!content) return;

  const nodeState = encounterRandomState(content.id);
  const fight = nodeState?.fights[fightIndex];
  if (!fight) return;

  const monsters = fight.monsters
    .map((monster) => getEntry<MonsterContent>(monster.monsterId))
    .filter((monster): monster is MonsterContent => !!monster);

  const combat: Combat = {
    ...combatCreateForEncounter(
      partyGet(),
      monsters,
      fight.level,
      entry.nodeName,
    ),
    encounterRandomId: content.id,
    fightIndex,
  };

  combatMessageLog(combat, `Encountering monster group #${fightIndex + 1}...`);
  analyticsSendDesignEvent('Combat:Encounter:Random');

  updateGamestate((state) => {
    state.world.combat = combat;
    return state;
  });
}

function markEncounterRandomCompleted(
  encounterRandomId: EncounterRandomId,
): void {
  updateGamestate((state) => {
    const nodeState = state.world.exploreRandom[encounterRandomId];
    if (nodeState) nodeState.completedThisCycle = true;
    return state;
  });
}

// Fires once the last generated fight has been won - rolled fresh every
// cycle, same as `grantEncounterCompletionRewards` for static encounters.
function grantEncounterRandomCompletionRewards(combat: Combat): void {
  if (!combat.encounterRandomId) return;

  const content = getEntry<EncounterRandomContent>(combat.encounterRandomId);
  if (!content) return;

  analyticsSendDesignEvent('World:Event:Complete');

  // The fight's level is rolled once per generation and applied to every
  // guardian at `encounterRandomStartFight` time, so the first guardian's
  // level represents it - same convention as the static-encounter path.
  const level = combat.guardians[0]?.level ?? 1;
  const drops = rollDroppedRewards(content.completionRewards, level);
  grantResolvedDrops(combat, drops);

  markEncounterRandomCompleted(combat.encounterRandomId);
}

// Fires once per physical node, ever - the regeneration cycle keeps rolling
// completionRewards fresh, but the ledger (not completedThisCycle) is what
// keeps this genuinely once-ever. Same shape as
// combat-end.ts's grantEncounterFirstTimeRewards.
function grantEncounterRandomFirstTimeRewards(combat: Combat): void {
  if (!combat.encounterRandomId) return;

  const content = getEntry<EncounterRandomContent>(combat.encounterRandomId);
  if (!content?.firstTimeRewards?.length) return;
  if (isFirstTimeNodeRewardsGranted(combat.locationName)) return;

  const level = combat.guardians[0]?.level ?? 1;
  const drops = rollDroppedRewards(content.firstTimeRewards, level);
  grantResolvedDrops(combat, drops);

  const rpItemId = researchPointItemId();
  const rpGranted = sumBy(
    drops.filter(
      (drop): drop is ResolvedItemDrop =>
        'itemId' in drop && drop.itemId === rpItemId,
    ),
    (drop) => drop.quantity,
  );
  markFirstTimeNodeRewardsGranted(combat.locationName, rpGranted);
}

// Returns true if another generated fight was started - callers must not
// reset combat state in that case, mirroring `nextFightFor`/
// `handleCombatVictory` in combat-end.ts for static encounters.
export function encounterRandomHandleVictory(combat: Combat): boolean {
  if (!combat.encounterRandomId) return false;

  const nodeState = encounterRandomState(combat.encounterRandomId);
  const nextFightIndex = (combat.fightIndex ?? 0) + 1;
  const nextFight = nodeState?.fights[nextFightIndex];

  if (!nextFight) {
    grantEncounterRandomCompletionRewards(combat);
    grantEncounterRandomFirstTimeRewards(combat);
    return false;
  }

  const entry = worldNodeByName(combat.locationName);
  if (!entry) return false;

  encounterRandomStartFight(entry, nextFightIndex);
  return true;
}
