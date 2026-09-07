import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type { TownContent, TownId, WorldNodeEntry } from '@interfaces';

// Honored - the minimum reputation tier at which a town can be designated home.
export const TOWN_HOME_MIN_REPUTATION_TIER = 2;

// The recall target for Deaths Door and the ReturnToKingdom decree clause - a designated Town, falling back to the Duchy if never set or if its content is later removed.
export function homeNodeGet(): WorldNodeEntry | undefined {
  const homeNodeName = gamestate().world.homeNodeName;
  if (homeNodeName) {
    const entry = worldNodeByName(homeNodeName);
    if (entry && worldNodeTown(entry)) return entry;
  }

  return kingdomNodeGet();
}

export function isPlayerAtHome(): boolean {
  const current = worldNodeAtCurrentLocation();
  const home = homeNodeGet();
  return !!current && !!home && current.nodeName === home.nodeName;
}

// Visited + Honored+ reputation - once set, home stays sticky even if reputation later drops.
export function canSetHomeNode(townId: TownId): boolean {
  const town = gamestate().world.towns[townId];
  if (!town || town.firstVisitedAtTick === undefined) return false;

  return townReputationTier(townId) >= TOWN_HOME_MIN_REPUTATION_TIER;
}

export function homeNodeSet(townId: TownId): void {
  if (!canSetHomeNode(townId)) return;

  const town = getEntry<TownContent>(townId);
  if (!town) return;

  updateGamestate((state) => {
    state.world.homeNodeName = town.name;
    return state;
  });

  analyticsSendDesignEvent(`Town:Home:Set:${analyticsSafeSegment(town.name)}`);
}

// Drops a home designation whose Town content no longer exists.
export function pruneInvalidHomeNode(
  homeNodeName?: string,
): string | undefined {
  if (!homeNodeName) return undefined;

  const entry = worldNodeByName(homeNodeName);
  if (!entry || !worldNodeTown(entry)) return undefined;

  return homeNodeName;
}
