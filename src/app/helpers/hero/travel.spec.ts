import type * as PathfindingHelper from '@helpers/pathfinding/pathfinding';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/caravan/caravan');
vi.mock('@helpers/encounter/encounter');
vi.mock('@helpers/encounter/encounter-random-combat');
vi.mock('@helpers/engine/ui');
vi.mock('@helpers/item/gathering');
vi.mock('@helpers/pathfinding/pathfinding-travel');
vi.mock('@helpers/town/reputation/town-reputation-buff');
vi.mock('@helpers/world-node/world-node-encounter');
vi.mock('@helpers/pathfinding/pathfinding', async (importOriginal) => ({
  ...(await importOriginal<typeof PathfindingHelper>()),
  mapHopsBetween: vi.fn(() => 0),
}));

import { caravanMarkVisited } from '@helpers/caravan/caravan';
import { combatLog } from '@helpers/combat/combat-log';
import {
  DEATHS_DOOR_MINIMUM_SECONDS,
  DEATHS_DOOR_SECONDS_PER_MAP,
  TICKS_PER_STEP_OFF_PATH,
  TICKS_PER_STEP_ON_PATH,
} from '@helpers/config';
import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { mapNodeAutoShowOnArrival } from '@helpers/engine/ui';
import {
  canPartyTravel,
  travelBeginDeathsDoor,
  travelEtaSecondsTo,
  travelProcessTick,
  travelRelocateTo,
  travelStart,
} from '@helpers/hero/travel';
import { gatheringStart, gatheringStop } from '@helpers/item/gathering';
import { mapHopsBetween } from '@helpers/pathfinding/pathfinding';
import { travelPathTo } from '@helpers/pathfinding/pathfinding-travel';
import {
  gamestate,
  worldAutoModeState,
  worldCurrentLocationState,
  worldTravelState,
} from '@helpers/state-game';
import { townReputationBuffSync } from '@helpers/town/reputation/town-reputation-buff';
import { outpostDeathPenaltyMultiplier } from '@helpers/world-node/world-node-outpost';
import type {
  Combat,
  CurrentLocation,
  GameState,
  GlobalEffectId,
  TravelState,
  TravelStep,
  WorldNodeEntry,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const ORIGIN: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };
const move = (x: number, mapName = 'Carrina'): TravelStep => ({
  kind: 'Move',
  mapName,
  x,
  y: 0,
});
const teleport = (mapName: string): TravelStep => ({
  kind: 'Teleport',
  mapName,
  x: 0,
  y: 0,
});

const at = (x: number, mapName = 'Carrina'): CurrentLocation => ({
  mapName,
  x,
  y: 0,
});

let nodes: Record<string, WorldNodeEntry>;

function seedWorld(pathTiles: { x: number; y: number }[] = []): void {
  nodes = seedWorldNodes(
    [
      { name: 'The Duchy', type: 'Kingdom', mapName: 'Carrina', x: 50, y: 50 },
      { name: 'Field Ruins', type: 'ExploreNode', mapName: 'Carrina', x: 5 },
      { name: 'Wergen Woods', type: 'GatherNode', mapName: 'Carrina', x: 6 },
      { name: 'Caravan', type: 'CaravanNode', mapName: 'Carrina', x: 7 },
      { name: 'Signpost', type: 'ExploreNode', mapName: 'Carrina', x: 8 },
      { name: 'Carrina Outpost', type: 'Outpost', mapName: 'Carrina', x: 9 },
      { name: 'Spider Tower', type: 'ExploreNode', mapName: 'Carrina', x: 10 },
    ],
    pathTiles.map((tile) => ({ mapName: 'Carrina', ...tile })),
  );
}

function seedTravel(
  travel: Partial<TravelState>,
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.world.currentLocation = ORIGIN;
    state.world.travel = {
      status: 'Traveling',
      path: [],
      ticksIntoStep: 0,
      ...travel,
    };
    edit?.(state);
  });
}

function seedIdle(edit?: (state: GameState) => void): void {
  seedTravel({ status: 'Idle' }, edit);
}

function activeEffect(state: GameState, name: string): void {
  state.globalEffects.push({
    id: name as GlobalEffectId,
    startTick: 0,
    expiresAtTick: 999,
  } as GameState['globalEffects'][number]);
}

function messages(): string[] {
  return combatLog().map((entry) => entry.message);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mapHopsBetween).mockReturnValue(0);
  seedWorld();
  seedContent([
    ensureGlobalEffect({ id: 'Deaths Door' as never, name: 'Deaths Door' }),
    ensureGlobalEffect({ id: 'Healing' as never, name: 'Healing' }),
    ensureEncounter({ id: 'field-ruins' as never, name: 'Field Ruins' }),
    ensureEncounter({
      id: 'spider-tower' as never,
      name: 'Spider Tower',
      invisibleUntilCollectibleIdsFound: ['spider-key' as never],
    }),
    ensureGathering({ id: 'wergen' as never, name: 'Wergen Woods' }),
    ensureCaravan({ id: 'duchy-caravan' as never, name: 'Caravan' }),
    ensureOutpost({ id: 'outpost' as never, name: 'Carrina Outpost' }),
  ]);
});

describe('canPartyTravel', () => {
  it('allows travel when idle or already traveling', () => {
    seedIdle();
    expect(canPartyTravel()).toBe(true);

    seedTravel({ destinationNodeName: 'Field Ruins' });
    expect(canPartyTravel()).toBe(true);
  });

  it('blocks travel during Deaths Door, Healing or combat', () => {
    seedIdle((state) => activeEffect(state, 'Deaths Door'));
    expect(canPartyTravel()).toBe(false);

    seedIdle((state) => activeEffect(state, 'Healing'));
    expect(canPartyTravel()).toBe(false);

    seedIdle((state) => (state.world.combat = {} as Combat));
    expect(canPartyTravel()).toBe(false);
  });
});

describe('travelEtaSecondsTo', () => {
  it('is undefined when idle or heading somewhere else', () => {
    seedIdle();
    expect(travelEtaSecondsTo('Field Ruins')).toBeUndefined();

    seedTravel({ destinationNodeName: 'Elsewhere', path: [move(1)] });
    expect(travelEtaSecondsTo('Field Ruins')).toBeUndefined();
  });

  it('counts the rest of the current step plus every later step', () => {
    seedTravel({
      destinationNodeName: 'Field Ruins',
      path: [move(1), move(2)],
      ticksIntoStep: 1,
    });

    expect(travelEtaSecondsTo('Field Ruins')).toBe(
      2 * TICKS_PER_STEP_OFF_PATH - 1,
    );
  });

  it('rounds a fractional remainder up to the tick the party arrives on', () => {
    seedTravel(
      {
        destinationNodeName: 'Field Ruins',
        path: [move(1), move(2)],
        ticksIntoStep: 1,
      },
      (state) => (state.globalEffectSums.offPathTravelSpeedBonus = 0.1),
    );

    expect(travelEtaSecondsTo('Field Ruins')).toBe(
      Math.ceil(2 * TICKS_PER_STEP_OFF_PATH * 0.9 - 1),
    );
  });
});

describe('travelStart', () => {
  const start = (destination: string, isAutoMode = false) =>
    inTick(() => travelStart(destination, isAutoMode));

  beforeEach(() => vi.mocked(travelPathTo).mockReturnValue([move(1)]));

  it('starts traveling, stopping any gathering and logging the departure', () => {
    seedIdle();
    const events = captureAnalyticsEvents();

    expect(start('Field Ruins')).toBe(true);

    expect(worldTravelState()).toEqual({
      status: 'Traveling',
      destinationNodeName: 'Field Ruins',
      path: [move(1)],
      ticksIntoStep: 0,
    });
    expect(gatheringStop).toHaveBeenCalled();
    expect(events).toEqual(['World:Travel:Start:Field Ruins']);
    expect(messages()).toEqual(['The party left for Field Ruins.']);
  });

  it('refuses when the party cannot travel, or the destination is collectible-gated', () => {
    seedIdle((state) => activeEffect(state, 'Deaths Door'));
    expect(start('Field Ruins')).toBe(false);

    seedIdle();
    const before = gamestate();
    expect(start('Spider Tower')).toBe(false);
    expect(gamestate()).toBe(before);
  });

  it('redirects mid-travel, but not to the destination already being traveled to', () => {
    seedTravel({
      destinationNodeName: 'Field Ruins',
      path: [move(1)],
      ticksIntoStep: 2,
    });
    expect(start('Field Ruins')).toBe(false);

    vi.mocked(travelPathTo).mockReturnValue([move(-1)]);
    expect(start('Signpost')).toBe(true);
    expect(worldTravelState()).toEqual({
      status: 'Traveling',
      destinationNodeName: 'Signpost',
      path: [move(-1)],
      ticksIntoStep: 0,
    });
    expect(messages()).toEqual(['The party changed course for Signpost.']);
  });

  it('settles as arrived when a redirect targets the tile already stood on', () => {
    seedTravel({ destinationNodeName: 'Field Ruins', path: [move(1)] });
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(start('Signpost')).toBe(true);

    expect(worldTravelState()).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
    expect(mapNodeAutoShowOnArrival).toHaveBeenCalledWith(nodes['Signpost']);
  });

  it('ignores a manual travel to the current tile, but re-triggers it for auto mode', () => {
    vi.mocked(travelPathTo).mockReturnValue([]);
    seedIdle();
    const before = gamestate();

    expect(start('Field Ruins')).toBe(false);
    expect(gamestate()).toBe(before);

    expect(start('Field Ruins', true)).toBe(true);
    expect(encounterStartFight).toHaveBeenCalledWith(
      'field-ruins',
      0,
      'Field Ruins',
    );
  });

  it('recalls the party to the kingdom when no route exists', () => {
    vi.mocked(travelPathTo).mockReturnValue(undefined);
    seedTravel({ destinationNodeName: 'Signpost', path: [move(1)] });

    expect(start('Field Ruins')).toBe(false);

    expect(worldCurrentLocationState()).toEqual(locationOf(nodes['The Duchy']));
    expect(worldTravelState().status).toBe('Idle');
    expect(messages()[0]).toContain('Pathing error');
  });

  it('just resets travel when no route exists and there is no kingdom to recall to', () => {
    vi.mocked(travelPathTo).mockReturnValue(undefined);
    seedWorldNodes([{ name: 'Field Ruins', type: 'ExploreNode' }]);
    seedTravel({ destinationNodeName: 'Signpost', path: [move(1)] });

    expect(start('Field Ruins')).toBe(false);

    expect(worldCurrentLocationState()).toEqual(ORIGIN);
    expect(worldTravelState().status).toBe('Idle');
  });

  it('turns auto mode off for a manual travel, but leaves it alone for an auto-mode one', () => {
    seedIdle((state) => (state.world.autoMode.enabled = true));
    start('Field Ruins', true);
    expect(worldAutoModeState().enabled).toBe(true);

    start('Signpost');
    expect(worldAutoModeState().enabled).toBe(false);
  });
});

describe('travelRelocateTo', () => {
  it('jumps the party, cancelling travel and gathering, and syncs reputation across maps', () => {
    seedTravel({ destinationNodeName: 'Somewhere', path: [move(1)] });

    inTick(() => travelRelocateTo({ mapName: 'LarsianDesert', x: 4, y: 7 }));

    expect(worldCurrentLocationState()).toEqual({
      mapName: 'LarsianDesert',
      x: 4,
      y: 7,
    });
    expect(worldTravelState()).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
    expect(gatheringStop).toHaveBeenCalled();
    expect(townReputationBuffSync).toHaveBeenCalledWith(
      'Carrina',
      'LarsianDesert',
    );
  });
});

describe('travelBeginDeathsDoor', () => {
  function deathsDoorTicks(): number {
    const effect = gamestate().globalEffects[0];
    return effect.expiresAtTick - effect.startTick;
  }

  function die(edit?: (state: GameState) => void): void {
    seedGamestate((state) => {
      state.world.currentLocation = { mapName: 'CraggledMire', x: 3, y: 3 };
      edit?.(state);
    });
    inTick(travelBeginDeathsDoor);
  }

  it('lasts a set time per map hop home, without moving the party', () => {
    vi.mocked(mapHopsBetween).mockReturnValue(2);

    die();

    expect(mapHopsBetween).toHaveBeenCalledWith('CraggledMire', 'Carrina');
    expect(deathsDoorTicks()).toBe(2 * DEATHS_DOOR_SECONDS_PER_MAP);
    expect(worldCurrentLocationState().mapName).toBe('CraggledMire');
    expect(messages()).toEqual(['The fallen party awaits recall home.']);
  });

  it('applies the minimum when already on the home map', () => {
    die((state) => (state.world.currentLocation = at(3)));

    expect(mapHopsBetween).toHaveBeenCalledWith('Carrina', 'Carrina');

    expect(deathsDoorTicks()).toBe(DEATHS_DOOR_MINIMUM_SECONDS);
  });

  it('applies the minimum when there is no home node at all', () => {
    seedWorldNodes([{ name: 'Field Ruins', type: 'ExploreNode' }]);
    vi.mocked(mapHopsBetween).mockReturnValue(5);

    die();

    expect(deathsDoorTicks()).toBe(DEATHS_DOOR_MINIMUM_SECONDS);
  });

  it('shortens the timer by a developed home outpost, rounding up', () => {
    die((state) => {
      state.world.homeNodeName = 'Carrina Outpost';
      state.outposts['Carrina Outpost'] = { level: 2 };
    });
    const multiplier = outpostDeathPenaltyMultiplier('Carrina Outpost');

    expect(multiplier).toBeLessThan(1);
    expect(Number.isInteger(DEATHS_DOOR_MINIMUM_SECONDS * multiplier)).toBe(
      false,
    );
    expect(deathsDoorTicks()).toBe(
      Math.ceil(DEATHS_DOOR_MINIMUM_SECONDS * multiplier),
    );
  });
});

describe('travelProcessTick', () => {
  const tick = () => inTick(travelProcessTick);

  it('does nothing when idle', () => {
    seedIdle();
    const before = gamestate();

    tick();

    expect(gamestate()).toBe(before);
  });

  it('accumulates progress without moving until an off-path step is paid for', () => {
    seedTravel({
      destinationNodeName: 'Field Ruins',
      path: [move(1)],
      ticksIntoStep: TICKS_PER_STEP_OFF_PATH - 2,
    });

    tick();

    expect(worldCurrentLocationState()).toEqual(ORIGIN);
    expect(worldTravelState().ticksIntoStep).toBe(TICKS_PER_STEP_OFF_PATH - 1);
  });

  it('completes an off-path step at its cost, moving on to the next one', () => {
    seedTravel({
      destinationNodeName: 'Field Ruins',
      path: [move(1), move(2)],
      ticksIntoStep: TICKS_PER_STEP_OFF_PATH - 1,
    });

    tick();

    expect(worldCurrentLocationState()).toEqual(at(1));
    expect(worldTravelState()).toEqual({
      status: 'Traveling',
      destinationNodeName: 'Field Ruins',
      path: [move(2)],
      ticksIntoStep: 0,
    });
    expect(townReputationBuffSync).toHaveBeenCalledWith('Carrina', 'Carrina');
  });

  it('completes an on-path step at the cheaper on-path cost', () => {
    seedWorld([{ x: 1, y: 0 }]);
    seedTravel({
      destinationNodeName: 'Field Ruins',
      path: [move(1), move(2)],
      ticksIntoStep: TICKS_PER_STEP_ON_PATH - 1,
    });

    tick();

    expect(worldCurrentLocationState()).toEqual(at(1));
  });

  it('charges the on-path cost entering or leaving a node tile, so arrival and departure never stutter', () => {
    const ruins = nodes['Field Ruins'];
    seedTravel({ destinationNodeName: 'Field Ruins', path: [move(ruins.x)] });
    tick();
    expect(worldCurrentLocationState()).toEqual(locationOf(ruins));

    seedTravel(
      { destinationNodeName: 'Signpost', path: [move(ruins.x - 1)] },
      (state) => (state.world.currentLocation = locationOf(ruins)),
    );
    tick();
    expect(worldCurrentLocationState()).toEqual(at(ruins.x - 1));
  });

  it('still charges the off-path cost leaving an ordinary path tile onto an off-path tile', () => {
    seedWorld([{ x: 1, y: 0 }]);
    seedTravel(
      {
        destinationNodeName: 'Field Ruins',
        path: [move(2)],
        ticksIntoStep: TICKS_PER_STEP_ON_PATH - 1,
      },
      (state) => (state.world.currentLocation = at(1)),
    );

    tick();

    expect(worldCurrentLocationState()).toEqual(at(1));
  });

  it('carries surplus progress into the next step when a boosted step costs under a tick', () => {
    seedWorld([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    seedTravel(
      { destinationNodeName: 'Field Ruins', path: [move(1), move(2)] },
      (state) => (state.globalEffectSums.onPathTravelSpeedBonus = 0.25),
    );

    tick();

    expect(worldCurrentLocationState()).toEqual(at(1));
    expect(worldTravelState().path).toEqual([move(2)]);
    expect(worldTravelState().ticksIntoStep).toBeCloseTo(
      1 - TICKS_PER_STEP_ON_PATH * 0.75,
    );
  });

  it('resolves Teleport steps instantly, chaining them into the same tick', () => {
    seedTravel({
      destinationNodeName: 'Gateway',
      path: [move(1), teleport('CraggledMire')],
      ticksIntoStep: TICKS_PER_STEP_OFF_PATH - 1,
    });

    tick();

    expect(worldCurrentLocationState()).toEqual(at(0, 'CraggledMire'));
    expect(worldTravelState().status).toBe('Idle');
    expect(townReputationBuffSync).toHaveBeenLastCalledWith(
      'Carrina',
      'CraggledMire',
    );

    seedTravel({ destinationNodeName: 'Gateway', path: [teleport('Larsia')] });
    tick();
    expect(worldCurrentLocationState()).toEqual(at(0, 'Larsia'));
  });

  describe('arriving at the destination', () => {
    function arriveAt(name: string): void {
      const node = nodes[name];
      seedTravel(
        { destinationNodeName: name, path: [move(node.x)] },
        (state) => (state.world.currentLocation = at(node.x - 1)),
      );
      tick();
    }

    it('settles idle, logs the arrival and shows the node', () => {
      arriveAt('Signpost');

      expect(worldTravelState()).toEqual({
        status: 'Idle',
        path: [],
        ticksIntoStep: 0,
      });
      expect(messages()).toContain('The party has arrived at Signpost.');
      expect(mapNodeAutoShowOnArrival).toHaveBeenCalledWith(nodes['Signpost']);
      expect(encounterStartFight).not.toHaveBeenCalled();
      expect(gatheringStart).not.toHaveBeenCalled();
      expect(caravanMarkVisited).not.toHaveBeenCalled();
    });

    it('starts the first fight at an encounter node', () => {
      arriveAt('Field Ruins');

      expect(encounterStartFight).toHaveBeenCalledWith(
        'field-ruins',
        0,
        'Field Ruins',
      );
    });

    it('discovers and starts gathering at a gather node', () => {
      arriveAt('Wergen Woods');

      expect(gamestate().discoveredGatherNodes['Wergen Woods']).toBeDefined();
      expect(gatheringStart).toHaveBeenCalledWith('Wergen Woods');
    });

    it('marks a caravan visited', () => {
      arriveAt('Caravan');

      expect(caravanMarkVisited).toHaveBeenCalledWith('duchy-caravan');
    });
  });
});
