import { beforeEach, describe, expect, it } from 'vitest';

import { TOWN_HOME_MIN_REPUTATION_TIER } from '@helpers/config';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { ensureTown } from '@helpers/content/ensure-town';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import {
  canSetHomeNode,
  homeNodeGet,
  isPlayerAtHome,
  pruneInvalidHomeNode,
} from '@helpers/town/town-spawn';
import type { GameState, OutpostId, TownId, WorldNodeEntry } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const townId = 'larsia' as TownId;
const HONORED = TOWN_REPUTATION_THRESHOLDS[TOWN_HOME_MIN_REPUTATION_TIER];

let nodes: Record<string, WorldNodeEntry>;

beforeEach(() => {
  seedContent([
    ensureTown({ id: townId, name: 'Larsia' }),
    ensureOutpost({
      id: 'carrina-outpost' as OutpostId,
      name: 'Carrina Outpost',
    }),
  ]);
  nodes = seedWorldNodes([
    { name: 'Duchy', type: 'Kingdom' },
    { name: 'Larsia', type: 'NonPlayerKingdom' },
    { name: 'Carrina Outpost', type: 'Outpost' },
    { name: 'Field Ruins', type: 'ExploreNode' },
  ]);
});

const homeAt = (name?: string) => (state: GameState) =>
  (state.world.homeNodeName = name);

describe('homeNodeGet', () => {
  it('falls back to the kingdom when no home is set', () => {
    seedGamestate();

    expect(homeNodeGet()).toEqual(nodes['Duchy']);
  });

  it('resolves a designated home town or outpost', () => {
    seedGamestate(homeAt('Larsia'));
    expect(homeNodeGet()).toEqual(nodes['Larsia']);

    seedGamestate(homeAt('Carrina Outpost'));
    expect(homeNodeGet()).toEqual(nodes['Carrina Outpost']);
  });

  it('falls back to the kingdom when the home is missing or no longer a town or outpost', () => {
    seedGamestate(homeAt('Gone'));
    expect(homeNodeGet()).toEqual(nodes['Duchy']);

    seedGamestate(homeAt('Field Ruins'));
    expect(homeNodeGet()).toEqual(nodes['Duchy']);
  });
});

describe('isPlayerAtHome', () => {
  it('compares the current location against the home node', () => {
    seedGamestate((state) => {
      homeAt('Larsia')(state);
      state.world.currentLocation = locationOf(nodes['Larsia']);
    });
    expect(isPlayerAtHome()).toBe(true);

    seedGamestate((state) => {
      state.world.currentLocation = locationOf(nodes['Field Ruins']);
    });
    expect(isPlayerAtHome()).toBe(false);
  });
});

describe('canSetHomeNode', () => {
  function seedTown(
    firstVisitedAtTick: number | undefined,
    reputation: number,
  ) {
    seedGamestate((state) => {
      state.world.towns[townId] = buildTownNodeState({
        firstVisitedAtTick,
        reputation,
      });
    });
  }

  it('allows a town only once visited and at the home reputation tier', () => {
    seedTown(undefined, HONORED);
    expect(canSetHomeNode(nodes['Larsia'])).toBe(false);

    seedTown(10, HONORED - 1);
    expect(canSetHomeNode(nodes['Larsia'])).toBe(false);

    seedTown(10, HONORED);
    expect(canSetHomeNode(nodes['Larsia'])).toBe(true);
  });

  it('allows an outpost only once built and with the party there', () => {
    const outpost = nodes['Carrina Outpost'];
    const seedOutpost = (level: number, at: WorldNodeEntry) =>
      seedGamestate((state) => {
        state.outposts['Carrina Outpost'] = { level };
        state.world.currentLocation = locationOf(at);
      });

    seedOutpost(0, outpost);
    expect(canSetHomeNode(outpost)).toBe(false);

    seedOutpost(1, nodes['Field Ruins']);
    expect(canSetHomeNode(outpost)).toBe(false);

    seedOutpost(1, outpost);
    expect(canSetHomeNode(outpost)).toBe(true);
  });

  it('never allows any other node type, even with outpost-like state', () => {
    seedGamestate((state) => {
      state.outposts['Field Ruins'] = { level: 1 };
      state.world.currentLocation = locationOf(nodes['Field Ruins']);
    });

    expect(canSetHomeNode(nodes['Field Ruins'])).toBe(false);
  });
});

describe('pruneInvalidHomeNode', () => {
  it('keeps a home that is still a town or outpost', () => {
    expect(pruneInvalidHomeNode('Larsia')).toBe('Larsia');
    expect(pruneInvalidHomeNode('Carrina Outpost')).toBe('Carrina Outpost');
  });

  it('drops a home that no longer exists or is no longer a town or outpost', () => {
    expect(pruneInvalidHomeNode(undefined)).toBeUndefined();
    expect(pruneInvalidHomeNode('Gone')).toBeUndefined();
    expect(pruneInvalidHomeNode('Field Ruins')).toBeUndefined();
  });
});
