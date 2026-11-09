import { describe, expect, it } from 'vitest';

import { visitedWorldNodesState } from '@helpers/state-game';
import {
  isWorldNodeVisited,
  worldNodeVisit,
} from '@helpers/world-node/world-node-visit';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const woods = 'Wergen Woods';
const shrine = 'Old Shrine';

function seedNodes() {
  return seedWorldNodes([
    { name: woods, type: 'GatherNode' },
    { name: shrine, type: 'Shrine' },
  ]);
}

describe('worldNodeVisit', () => {
  it('visits a node once, keeping its first foundAt and reporting it only then', () => {
    const nodes = seedNodes();
    seedGamestate();
    const events = captureAnalyticsEvents();
    expect(isWorldNodeVisited(woods)).toBe(false);

    inTick(() => worldNodeVisit(nodes[woods]));
    const { foundAt } = visitedWorldNodesState()[woods];
    inTick(() => worldNodeVisit(nodes[woods]));

    expect(isWorldNodeVisited(woods)).toBe(true);
    expect(visitedWorldNodesState()[woods].foundAt).toBe(foundAt);
    expect(events).toEqual([`World:GatherNode:Discover:${woods}`]);
  });

  it('records non-gather nodes too', () => {
    const nodes = seedNodes();
    seedGamestate();
    const events = captureAnalyticsEvents();

    inTick(() => worldNodeVisit(nodes[shrine]));

    expect(isWorldNodeVisited(shrine)).toBe(true);
    expect(events).toEqual([`World:Shrine:Discover:${shrine}`]);
  });

  it('keeps the foundAt of a node visited before', () => {
    const nodes = seedNodes();
    seedGamestate((state) => {
      state.visitedWorldNodes[woods] = { foundAt: 1000 };
    });
    const events = captureAnalyticsEvents();

    inTick(() => worldNodeVisit(nodes[woods]));

    expect(visitedWorldNodesState()[woods].foundAt).toBe(1000);
    expect(events).toEqual([]);
  });
});
