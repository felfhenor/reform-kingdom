import { TOWN_HOME_MIN_REPUTATION_TIER } from '@helpers/config';
import { worldHomeNodeNameState, worldTownsState } from '@helpers/state-game';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { isPartyAtNode, worldNodeAtCurrentLocation } from '@helpers/world';
import { isOutpostBuilt } from '@helpers/world-node/world-node-outpost';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeOutpost,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type { TownId, WorldNodeEntry } from '@interfaces';

function isHomeNodeType(entry: WorldNodeEntry): boolean {
  return !!worldNodeTown(entry) || !!worldNodeOutpost(entry);
}

// The recall target for Deaths Door and the ReturnToKingdom decree clause - a designated Town or Outpost, falling back to the Duchy if never set or if its content is later removed.
export function homeNodeGet(): WorldNodeEntry | undefined {
  const homeNodeName = worldHomeNodeNameState();
  if (homeNodeName) {
    const entry = worldNodeByName(homeNodeName);
    if (entry && isHomeNodeType(entry)) return entry;
  }

  return kingdomNodeGet();
}

export function isPlayerAtHome(): boolean {
  const current = worldNodeAtCurrentLocation();
  const home = homeNodeGet();
  return !!current && !!home && current.nodeName === home.nodeName;
}

// Visited + Honored+ reputation - once set, home stays sticky even if reputation later drops.
function canSetTownHome(townId: TownId): boolean {
  const town = worldTownsState()[townId];
  if (!town || town.firstVisitedAtTick === undefined) return false;

  return townReputationTier(townId) >= TOWN_HOME_MIN_REPUTATION_TIER;
}

// Outposts are claimed in person, like developing them.
export function canSetHomeNode(entry: WorldNodeEntry): boolean {
  const town = worldNodeTown(entry);
  if (town) return canSetTownHome(town.id);

  if (!worldNodeOutpost(entry)) return false;
  return isOutpostBuilt(entry.nodeName) && isPartyAtNode(entry.nodeName);
}

// Drops a home designation whose Town/Outpost content no longer exists.
export function pruneInvalidHomeNode(
  homeNodeName?: string,
): string | undefined {
  if (!homeNodeName) return undefined;

  const entry = worldNodeByName(homeNodeName);
  if (!entry || !isHomeNodeType(entry)) return undefined;

  return homeNodeName;
}
