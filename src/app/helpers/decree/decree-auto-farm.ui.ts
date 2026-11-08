import { autoModeToggle } from '@helpers/decree/auto-mode-state';
import {
  decreeClauseCreate,
  decreeClauses,
  isAutoFarmClause,
} from '@helpers/decree/decree';
import { isExploreNodeCleared } from '@helpers/decree/decree-farm-node';
import { decreeClauseRemove } from '@helpers/decree/decree.ui';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import type { DecreeClause, WorldNodeEntry } from '@interfaces';

export function decreeAutoFarmAvailable(entry: WorldNodeEntry): boolean {
  return (
    entry.nodeData.type === 'ExploreNode' &&
    isExploreNodeCleared(entry) &&
    isPartyAtNode(entry.nodeName)
  );
}

function decreeAutoFarmClause(nodeName: string): DecreeClause | undefined {
  return decreeClauses()
    .filter(isAutoFarmClause)
    .find((clause) => clause.nodeName === nodeName);
}

export function decreeAutoFarmIsActive(nodeName: string): boolean {
  return !!decreeAutoFarmClause(nodeName);
}

// Replaces any other node's auto-farm, so there's only ever one pinned clause.
export function decreeAutoFarmStart(nodeName: string): void {
  const clause = decreeClauseCreate({ type: 'AutoFarmNode', nodeName });

  updateGamestate((state) => {
    const autoMode = state.world.autoMode;
    if (
      autoMode.clauses.some(
        (other) =>
          isAutoFarmClause(other) && other.id === autoMode.activeClauseId,
      )
    ) {
      autoMode.activeClauseId = undefined;
    }
    autoMode.clauses = [
      clause,
      ...autoMode.clauses.filter((other) => !isAutoFarmClause(other)),
    ];
    return state;
  });
  autoModeToggle(true);

  analyticsSendDesignEvent('Decree:AutoFarm:Start');
  analyticsSendDesignEvent(
    `Decree:AutoFarm:Start:${analyticsSafeSegment(nodeName)}`,
  );
}

export function decreeAutoFarmStop(nodeName: string): void {
  const clause = decreeAutoFarmClause(nodeName);
  if (!clause) return;

  decreeClauseRemove(clause.id);
  analyticsSendDesignEvent('Decree:AutoFarm:Stop');
}
