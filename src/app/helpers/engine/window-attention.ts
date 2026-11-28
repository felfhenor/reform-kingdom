import { t } from '@helpers/i18n/i18n';
import { contentNameById } from '@helpers/i18n/i18n-content';
import { tradeskillBuilding } from '@helpers/crafting/tradeskill';
import { armoryHasRoom } from '@helpers/kingdom/armory';
import { isFelDefeated, isRunLost } from '@helpers/lore/outro';
import { workersState } from '@helpers/state-game';
import { workerXpIsFull } from '@helpers/worker/worker-progression';
import type { WindowAttentionAlert, WorkerId } from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

function runAttentionAlerts(): WindowAttentionAlert[] {
  const candidates: [boolean, WindowAttentionAlert][] = [
    [
      isFelDefeated(),
      {
        id: 'run-won',
        flash: true,
        category: 'Alerts',
        title: t('windowAttention.victory'),
        body: t('windowAttention.felDefeated'),
      },
    ],
    [
      isRunLost(),
      {
        id: 'run-lost',
        flash: true,
        category: 'Alerts',
        title: t('windowAttention.gameOver'),
        body: t('windowAttention.partyFallen'),
      },
    ],
    [
      !armoryHasRoom(),
      {
        id: 'armory-full',
        flash: true,
        category: 'Alerts',
        title: t('windowAttention.armoryFull'),
        body: t('windowAttention.armoryFullBody'),
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
    title: t('windowAttention.craftingFinished'),
    body: t('windowAttention.hasNothingLeftTo', {
      tradeskill: contentNameById(tradeskill) ?? tradeskill,
    }),
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
      title: t('windowAttention.workerXpFull'),
      body: t('windowAttention.hasFullXpAnd', {
        worker: contentNameById(workerId) ?? t('windowAttention.aWorker'),
      }),
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
