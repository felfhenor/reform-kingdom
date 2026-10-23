import {
  categoryMessageLog,
  miscellaneousMessageLog,
} from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { canSetHomeNode } from '@helpers/town/town-spawn';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export async function homeNodeSet(entry: WorldNodeEntry): Promise<void> {
  if (!canSetHomeNode(entry)) return;

  await updateGamestate((state) => {
    state.world.homeNodeName = entry.nodeName;
    return state;
  });

  categoryMessageLog(
    'Miscellaneous',
    entry.nodeName,
    `**${entry.nodeName}** is now your home.`,
  );
  const category = worldNodeTown(entry) ? 'Town' : 'Outpost';
  analyticsSendDesignEvent(
    `${category}:Home:Set:${analyticsSafeSegment(entry.nodeName)}`,
  );
}

export async function homeNodeResetToDuchy(): Promise<void> {
  await updateGamestate((state) => {
    state.world.homeNodeName = undefined;
    return state;
  });

  miscellaneousMessageLog('The **Duchy** is your home once again.');
  analyticsSendDesignEvent(`Town:Home:Set:Duchy`);
}
