import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { worldDiscoveriesState } from '@helpers/state-game';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node/world-node-discovery';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';

const grove = 'Hidden Grove';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(5000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('worldNodeDiscover', () => {
  it('records the discovery, notifying and tracking only the first time', () => {
    seedGamestate();
    const notifications = captureNotifications();
    const events = captureAnalyticsEvents();

    inTick(() => {
      worldNodeDiscover(grove);
      worldNodeDiscover(grove);
    });

    expect(isWorldNodeDiscovered(grove)).toBe(true);
    expect(worldDiscoveriesState()[grove]).toEqual({ foundAt: 5000 });
    expect(notifications).toEqual([
      { message: `You discovered ${grove}!`, type: 'success' },
    ]);
    expect(events).toEqual([`World:Node:Discover:${grove}`]);
  });

  it('keeps the original foundAt on a repeat discovery', () => {
    seedGamestate((state) => {
      state.worldDiscoveries[grove] = { foundAt: 1000 };
    });

    inTick(() => worldNodeDiscover(grove));

    expect(worldDiscoveriesState()[grove]).toEqual({ foundAt: 1000 });
  });
});

describe('worldNodeUndiscover', () => {
  it('reverts the node to undiscovered', () => {
    seedGamestate((state) => {
      state.worldDiscoveries[grove] = { foundAt: 1000 };
    });

    inTick(() => worldNodeUndiscover(grove));

    expect(isWorldNodeDiscovered(grove)).toBe(false);
  });
});
