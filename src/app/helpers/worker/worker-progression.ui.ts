import { resolvedDropLogPart } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { goldCoinId, spendGold } from '@helpers/item/materials';
import { tradeGoodsLogPart, tradeLog } from '@helpers/item/trade';
import { gamestate, updateGamestate, workersState } from '@helpers/state-game';
import {
  workerIsReadyToLevelUp,
  workerLevelUpCost,
  workerXpForLevel,
  workerXpIsFull,
} from '@helpers/worker/worker-progression';
import type {
  WorkerContent,
  WorkerId,
  WorkerLevelUpStatusEntry,
} from '@interfaces';

// One entry per rescued worker with full xp, affordable or not - built for the corner status indicator.
export function workersLevelUpStatusEntries(): WorkerLevelUpStatusEntry[] {
  const workers = workersState();

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const worker = workers[workerId];
      if (!workerXpIsFull(worker)) return undefined;

      const content = getEntry<WorkerContent>(workerId);
      if (!content) return undefined;

      return {
        workerId,
        name: content.name,
        sprite: content.sprite,
        frames: content.frames,
        level: worker.level,
        cost: workerLevelUpCost(worker.level),
        affordable: workerIsReadyToLevelUp(worker),
      };
    })
    .filter((entry): entry is WorkerLevelUpStatusEntry => !!entry);
}

function workerLevelUpLog(
  workerId: WorkerId,
  level: number,
  cost: number,
): void {
  const worker = resolvedDropLogPart({ kind: 'Worker', workerId });
  tradeLog(
    'Miscellaneous',
    'promoted',
    [
      worker
        ? { ...worker, html: `${worker.html} to level ${level}` }
        : undefined,
    ],
    [tradeGoodsLogPart({ itemId: goldCoinId() }, cost)],
  );
}

// Deliberately no location/travel-state check - a worker can be leveled up
// from anywhere, not just while parked at the Duchy.
export async function workerLevelUp(workerId: WorkerId): Promise<boolean> {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;
  if (!workerIsReadyToLevelUp(worker)) return false;

  let cost = 0;
  let newLevel = 0;

  await updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target || !workerIsReadyToLevelUp(target)) return state;

    cost = workerLevelUpCost(target.level);
    spendGold(state, cost);
    target.level += 1;
    target.xp = { current: 0, maximum: workerXpForLevel(target.level) };
    newLevel = target.level;

    return state;
  });
  if (newLevel === 0) return false;

  workerLevelUpLog(workerId, newLevel, cost);

  const workerName = getEntry<WorkerContent>(workerId)?.name;
  analyticsSendDesignEvent(
    workerName
      ? `Worker:LevelUp:${analyticsSafeSegment(workerName)}`
      : 'Worker:LevelUp',
  );
  return true;
}
