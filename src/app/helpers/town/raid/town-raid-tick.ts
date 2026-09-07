import { getEntriesByType } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifyError } from '@helpers/engine/notify';
import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { partyMinLevel } from '@helpers/item/gathering';
import { mapHopsBetween } from '@helpers/pathfinding/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidDefenseGlobalEffectApply } from '@helpers/town/raid/town-raid-defense';
import { raidResolveDefeat } from '@helpers/town/raid/town-raid-resolve';
import { raidAssaulterMonsterIds } from '@helpers/town/raid/town-raid-state';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import {
  worldNodeByName,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { TownContent } from '@interfaces';

// Re-check cadence, not the actual cap.
const RAID_CHECK_INTERVAL_TICKS = 60;

export const RAID_COOLDOWN_TICKS = 14400;
const RAID_BASE_WARNING_TICKS = 300;
const RAID_WARNING_TICKS_PER_MAP_HOP = 120;
const RAID_WARNING_TICKS_PER_REPUTATION_TIER = 60;

// Fixed per town (distance + reputation), not the party's position - that would be exploitable.
function raidWarningWindowTicks(town: TownContent): number {
  const kingdom = worldNodesOfType('Kingdom')[0];
  const townNode = worldNodeByName(town.name);
  const hops =
    kingdom && townNode ? mapHopsBetween(kingdom.mapName, townNode.mapName) : 0;

  return (
    RAID_BASE_WARNING_TICKS +
    hops * RAID_WARNING_TICKS_PER_MAP_HOP +
    townReputationTier(town.id) * RAID_WARNING_TICKS_PER_REPUTATION_TIER
  );
}

// Exported so the debug tooling reuses the same write path, not a stand-in value.
export function telegraphRaid(town: TownContent): void {
  const now = timerTicksElapsed();
  const windowTicks = raidWarningWindowTicks(town);
  // Rolled once here (not at engage time) so the Raid tab preview always matches what actually spawns.
  const assaulterMonsterIds = raidAssaulterMonsterIds(town.defense.assaulter);

  analyticsSendDesignEvent(
    `Town:Raid:Telegraph:${analyticsSafeSegment(town.name)}`,
  );

  updateGamestate((state) => {
    const target = state.world.towns[town.id];
    if (target) {
      target.raidTelegraphedAtTick = now;
      target.raidEngageWindowExpiresAtTick = now + windowTicks;
      target.raidTelegraphedAssaulterIds = assaulterMonsterIds;
    }
    raidDefenseGlobalEffectApply(state, now);
    return state;
  });
}

function processTownRaid(town: TownContent): void {
  const state = gamestate().world.towns[town.id];
  if (!state || state.firstVisitedAtTick === undefined) return;
  // Its raid is actively being fought - without this the checks below would re-telegraph mid-fight.
  if (gamestate().world.combat?.raidTownId === town.id) return;

  const now = timerTicksElapsed();

  if (state.raidTelegraphedAtTick !== undefined) {
    if (
      state.raidEngageWindowExpiresAtTick !== undefined &&
      now >= state.raidEngageWindowExpiresAtTick
    ) {
      notifyError(`${town.name} was raided while undefended!`);
      raidResolveDefeat(town.id);
    }
    return;
  }

  if (
    state.lastRaidResolvedAtTick !== undefined &&
    now - state.lastRaidResolvedAtTick < RAID_COOLDOWN_TICKS
  ) {
    return;
  }

  const risk = riskBandForLevelRange(
    town.defense.assaulter.level,
    partyMinLevel(),
  );
  if (risk === 'TooHigh') return;

  telegraphRaid(town);
}

export function townRaidProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'raid', RAID_CHECK_INTERVAL_TICKS)) return;

    processTownRaid(town);
    markTownSubsystemProcessed(town.id, 'raid');
  });
}
