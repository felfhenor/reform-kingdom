import { getEntry } from '@helpers/content/content';
import { tradeskillBuilding } from '@helpers/crafting/tradeskill';
import { armoryHasRoom } from '@helpers/kingdom/armory';
import { isFelDefeated, isRunLost } from '@helpers/lore/outro';
import { workersState } from '@helpers/state-game';
import { workerXpIsFull } from '@helpers/worker/worker-progression';
import type {
  WindowAttentionAlert,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

function runAttentionAlerts(): WindowAttentionAlert[] {
  const candidates: [boolean, WindowAttentionAlert][] = [
    [
      isFelDefeated(),
      {
        id: 'run-won',
        flash: true,
        category: 'Alerts',
        title: 'Victory',
        body: 'Fel has been defeated.',
      },
    ],
    [
      isRunLost(),
      {
        id: 'run-lost',
        flash: true,
        category: 'Alerts',
        title: 'Game Over',
        body: 'Your party has fallen.',
      },
    ],
    [
      !armoryHasRoom(),
      {
        id: 'armory-full',
        flash: true,
        category: 'Alerts',
        title: 'Armory Full',
        body: 'New equipment has nowhere to go until you clean out your armory.',
      },
    ],
  ];
  return candidates.filter(([active]) => active).map(([, alert]) => alert);
}

function craftIdleAlerts(): WindowAttentionAlert[] {
  return ALL_TRADESKILLS.filter(
    (tradeskill) => tradeskillBuilding(tradeskill).queue.length === 0,
  ).map((tradeskill) => ({
    id: `craft-idle:${tradeskill}`,
    flash: false,
    category: 'Alerts',
    title: 'Crafting Finished',
    body: `${tradeskill} has nothing left to craft.`,
  }));
}

function workerXpFullAlerts(): WindowAttentionAlert[] {
  const workers = workersState();
  return (Object.keys(workers) as WorkerId[])
    .filter((workerId) => workerXpIsFull(workers[workerId]))
    .map((workerId) => ({
      id: `worker-xp-full:${workerId}`,
      flash: false,
      category: 'Alerts',
      title: 'Worker XP Full',
      body: `${getEntry<WorkerContent>(workerId)?.name ?? 'A worker'} has full XP and is waiting to level up.`,
    }));
}

export function windowAttentionAlerts(): WindowAttentionAlert[] {
  return [
    ...runAttentionAlerts(),
    ...craftIdleAlerts(),
    ...workerXpFullAlerts(),
  ];
}

// Only an alert turning on counts, so a run loaded already won, lost or full stays quiet.
export function windowAttentionRaised(
  previousIds: Set<string>,
  current: WindowAttentionAlert[],
): WindowAttentionAlert[] {
  return current.filter((alert) => !previousIds.has(alert.id));
}
