import { getEntry } from '@helpers/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { pruneInvalidTownStock } from '@helpers/town/shop/town-stock';
import {
  pruneInvalidTownWorkers,
  townWorkerRosterMaterialize,
} from '@helpers/town/worker/town-worker-roster';
import type {
  GameStateTowns,
  TownContent,
  TownId,
  TownTickSubsystem,
} from '@interfaces';

// Per-subsystem, not a single shared gate - independently-cadenced tick functions would otherwise clobber each other's due-check.
// An un-activated town (no state entry - never visited) is never due, so callers don't each have to re-check activation themselves.
export function isTownDueForUpdate(
  townId: TownId,
  subsystem: TownTickSubsystem,
  interval: number,
): boolean {
  const state = gamestate().world.towns[townId];
  if (!state) return false;

  const lastProcessed = state.lastProcessedTick[subsystem];
  if (lastProcessed === undefined) return true;

  return timerTicksElapsed() - lastProcessed >= interval;
}

export function markTownSubsystemProcessed(
  townId: TownId,
  subsystem: TownTickSubsystem,
): void {
  const nowTick = timerTicksElapsed();

  updateGamestate((state) => {
    const target = state.world.towns[townId];
    if (!target) return state;

    target.lastProcessedTick[subsystem] = nowTick;
    return state;
  });
}

export function pruneInvalidTowns(towns: GameStateTowns): GameStateTowns {
  const pruned: GameStateTowns = {};

  (Object.keys(towns) as TownId[]).forEach((townId) => {
    const town = getEntry<TownContent>(townId);
    if (town) {
      // Materialize after pruning, not just at first-visit - self-heals legacy saves and content that later adds a roster entry.
      const workers = townWorkerRosterMaterialize(
        town,
        pruneInvalidTownWorkers(town, towns[townId].workers ?? {}),
      );

      pruned[townId] = {
        ...towns[townId],
        stock: pruneInvalidTownStock(towns[townId].stock ?? []),
        workers,
        reputation: towns[townId].reputation ?? 0,
      };
    }
  });

  return pruned;
}
