import { describe, expect, it } from 'vitest';

import {
  gatherNodeDiscover,
  grandfatherGatherNodeDiscoveries,
  isGatherNodeDiscovered,
  pruneInvalidGatherNodeDiscoveries,
} from '@helpers/item/gather-node-discovery';
import { discoveredGatherNodesState } from '@helpers/state-game';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { inTick, seedGamestate } from '@/testing/gamestate';

const woods = 'Wergen Woods';

describe('gatherNodeDiscover', () => {
  it('discovers a node once, keeping its first foundAt and reporting it only then', () => {
    seedGamestate();
    const events = captureAnalyticsEvents();
    expect(isGatherNodeDiscovered(woods)).toBe(false);

    inTick(() => gatherNodeDiscover(woods));
    const { foundAt } = discoveredGatherNodesState()[woods];
    inTick(() => gatherNodeDiscover(woods));

    expect(isGatherNodeDiscovered(woods)).toBe(true);
    expect(discoveredGatherNodesState()[woods].foundAt).toBe(foundAt);
    expect(events).toEqual([`World:GatherNode:Discover:${woods}`]);
  });

  it('keeps the foundAt of a node discovered before', () => {
    seedGamestate((state) => {
      state.discoveredGatherNodes[woods] = { foundAt: 1000 };
    });
    const events = captureAnalyticsEvents();

    inTick(() => gatherNodeDiscover(woods));

    expect(discoveredGatherNodesState()[woods].foundAt).toBe(1000);
    expect(events).toEqual([]);
  });
});

describe('pruneInvalidGatherNodeDiscoveries', () => {
  it('keeps only nodes the existence check accepts', () => {
    expect(
      pruneInvalidGatherNodeDiscoveries(
        { [woods]: { foundAt: 1000 }, Removed: { foundAt: 2000 } },
        (nodeName) => nodeName === woods,
      ),
    ).toEqual({ [woods]: { foundAt: 1000 } });
  });
});

describe('grandfatherGatherNodeDiscoveries', () => {
  it('marks every given node discovered', () => {
    expect(grandfatherGatherNodeDiscoveries([woods, 'Rocky Outcrop'])).toEqual({
      [woods]: { foundAt: expect.any(Number) },
      'Rocky Outcrop': { foundAt: expect.any(Number) },
    });
  });
});
