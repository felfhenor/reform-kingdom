import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { notifySuccess } from '@helpers/engine/notify';
import { updateGamestate, worldDiscoveriesState } from '@helpers/state-game';

export function isWorldNodeDiscovered(nodeName: string): boolean {
  return ledgerHas(worldDiscoveriesState(), nodeName);
}

// Marks a hidden node as revealed - only notifies the player on the first
// discovery, so re-selecting an already-discovered node stays silent.
export function worldNodeDiscover(nodeName: string): void {
  const alreadyDiscovered = isWorldNodeDiscovered(nodeName);

  updateGamestate((state) => {
    ledgerMark(state.worldDiscoveries, nodeName);
    return state;
  });

  if (!alreadyDiscovered) {
    notifySuccess(`You discovered ${nodeName}!`);
    analyticsSendDesignEvent(
      `World:Node:Discover:${analyticsSafeSegment(nodeName)}`,
    );
  }
}

// Debug tool: reverts a node back to undiscovered.
export function worldNodeUndiscover(nodeName: string): void {
  updateGamestate((state) => {
    delete state.worldDiscoveries[nodeName];
    return state;
  });
}
