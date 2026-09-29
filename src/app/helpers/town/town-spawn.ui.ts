import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { canSetHomeNode } from '@helpers/town/town-spawn';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export function homeNodeSet(entry: WorldNodeEntry): void {
  if (!canSetHomeNode(entry)) return;

  updateGamestate((state) => {
    state.world.homeNodeName = entry.nodeName;
    return state;
  });

  const category = worldNodeTown(entry) ? 'Town' : 'Outpost';
  analyticsSendDesignEvent(
    `${category}:Home:Set:${analyticsSafeSegment(entry.nodeName)}`,
  );
}

export function homeNodeResetToDuchy(): void {
  updateGamestate((state) => {
    state.world.homeNodeName = undefined;
    return state;
  });

  analyticsSendDesignEvent(`Town:Home:Set:Duchy`);
}
