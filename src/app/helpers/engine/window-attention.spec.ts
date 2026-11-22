import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { WORKER_MAX_LEVEL } from '@helpers/config';
import { defaultTradeskillBuilding } from '@helpers/defaults';
import {
  windowAttentionAlerts,
  windowAttentionRaised,
} from '@helpers/engine/window-attention';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  GameState,
  RecipeId,
  TradeskillId,
  WindowAttentionAlert,
  WorkerId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { buildCraftQueueEntry } from '@/testing/builders';
import { beforeEach, describe, expect, it } from 'vitest';

function alert(id: string): WindowAttentionAlert {
  return { id, flash: false, category: 'Alerts', title: id, body: id };
}

describe('windowAttentionRaised', () => {
  it('raises an alert that just turned on', () => {
    expect(
      windowAttentionRaised(new Set(['a']), [alert('a'), alert('b')]),
    ).toEqual([alert('b')]);
  });

  it('stays quiet for an alert that was already on', () => {
    expect(windowAttentionRaised(new Set(['a']), [alert('a')])).toEqual([]);
  });

  it('stays quiet when an alert turns off', () => {
    expect(windowAttentionRaised(new Set(['a', 'b']), [alert('b')])).toEqual(
      [],
    );
  });

  it('raises again after an alert turns off and back on', () => {
    expect(windowAttentionRaised(new Set(['a']), [])).toEqual([]);
    expect(windowAttentionRaised(new Set(), [alert('a')])).toEqual([
      alert('a'),
    ]);
  });
});

const BLACKSMITHING_ID = 'blacksmithing' as TradeskillId;
const NELL_ID = 'nell' as WorkerId;

function alertIds(): string[] {
  return windowAttentionAlerts().map((alert) => alert.id);
}

function seedNell(level: number, xpFull: boolean): void {
  seedGamestate((state: GameState) => {
    const worker = defaultWorkerState();
    worker.level = level;
    if (xpFull) worker.xp.current = worker.xp.maximum;
    state.workers[NELL_ID] = worker;
  });
}

describe('windowAttentionAlerts', () => {
  beforeEach(() => {
    seedContent([
      ensureTradeskill({ id: BLACKSMITHING_ID, name: 'Blacksmithing' }),
      ensureWorker({ id: NELL_ID, name: 'Nell' }),
    ]);
  });

  it('alerts for a tradeskill with an empty queue', () => {
    seedGamestate();
    expect(alertIds()).toContain('craft-idle:Blacksmithing');
  });

  it('stays quiet for a tradeskill that is still crafting', () => {
    seedGamestate((state) => {
      state.tradeskills[BLACKSMITHING_ID] = {
        ...defaultTradeskillBuilding(),
        queue: [buildCraftQueueEntry({ recipeId: 'r' as RecipeId })],
      };
    });
    expect(alertIds()).not.toContain('craft-idle:Blacksmithing');
  });

  it('alerts by name for a worker with full xp', () => {
    seedNell(1, true);
    const alert = windowAttentionAlerts().find(
      ({ id }) => id === `worker-xp-full:${NELL_ID}`,
    );
    expect(alert?.body).toContain('Nell');
  });

  it('stays quiet for a worker without full xp', () => {
    seedNell(1, false);
    expect(alertIds()).not.toContain(`worker-xp-full:${NELL_ID}`);
  });

  it('stays quiet for a max-level worker', () => {
    seedNell(WORKER_MAX_LEVEL, true);
    expect(alertIds()).not.toContain(`worker-xp-full:${NELL_ID}`);
  });

  it('alerts with a flash when the run is lost', () => {
    seedGamestate((state) => {
      state.meta.runLost = true;
    });
    expect(
      windowAttentionAlerts().find(({ id }) => id === 'run-lost')?.flash,
    ).toBe(true);
  });
});
