import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import { updateGamestate, visitedWorldNodesState } from '@helpers/state-game';
import type { WorldNodeEntry } from '@interfaces';

export function isWorldNodeVisited(nodeName: string): boolean {
  return ledgerHas(visitedWorldNodesState(), nodeName);
}

export function worldNodeVisit(entry: WorldNodeEntry): void {
  const alreadyVisited = isWorldNodeVisited(entry.nodeName);

  updateGamestate((state) => {
    ledgerMark(state.visitedWorldNodes, entry.nodeName);
    return state;
  });

  // Event id predates non-gather visits; kept so GatherNode history stays continuous.
  if (!alreadyVisited) {
    analyticsSendDesignEvent(
      `World:${entry.nodeData.type}:Discover:${analyticsSafeSegment(entry.nodeName)}`,
    );
  }
}
