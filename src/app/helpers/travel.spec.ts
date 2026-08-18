import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/auto-mode', () => ({
  autoModeIsEnabled: vi.fn(() => false),
  autoModeToggle: vi.fn(),
}));

vi.mock('@helpers/global-effects', () => ({
  addGlobalEffect: vi.fn(),
  isGlobalEffectActive: vi.fn(() => false),
}));

vi.mock('@helpers/encounter', () => ({
  encounterStartFight: vi.fn(),
}));

vi.mock('@helpers/combat-log', () => ({
  travelMessageLog: vi.fn(),
}));

vi.mock('@helpers/gather-node-discovery', () => ({
  gatherNodeDiscover: vi.fn(),
}));

vi.mock('@helpers/gathering', () => ({
  gatheringStart: vi.fn(),
  gatheringStop: vi.fn(),
}));

vi.mock('@helpers/pathfinding', () => ({
  mapHopsBetween: vi.fn(() => 0),
  tileIsOnPath: vi.fn(() => false),
  travelPathTo: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  currentLocationGet: vi.fn(),
  currentLocationSet: vi.fn(),
}));

vi.mock('@helpers/world-node-encounter', () => ({
  worldNodeExploreRandomIsAvailable: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeAt: vi.fn(() => undefined),
  worldNodeByName: vi.fn(),
  worldNodeEncounter: vi.fn(),
  worldNodeEncounterRandom: vi.fn(),
  worldNodeGathering: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

vi.mock('@helpers/encounter-random-combat', () => ({
  encounterRandomStartFight: vi.fn(),
}));

vi.mock('@helpers/ui', () => ({
  mapNodeAutoShowOnArrival: vi.fn(),
}));

import { autoModeIsEnabled, autoModeToggle } from '@helpers/auto-mode';
import { addGlobalEffect, isGlobalEffectActive } from '@helpers/global-effects';
import { encounterStartFight } from '@helpers/encounter';
import { gatherNodeDiscover } from '@helpers/gather-node-discovery';
import { travelMessageLog } from '@helpers/combat-log';
import { gatheringStart, gatheringStop } from '@helpers/gathering';
import { mapHopsBetween, tileIsOnPath, travelPathTo } from '@helpers/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  canPartyTravel,
  travelBeginDeathsDoor,
  travelProcessTick,
  travelStart,
} from '@helpers/travel';
import { mapNodeAutoShowOnArrival } from '@helpers/ui';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
import {
  worldNodeAt,
  worldNodeByName,
  worldNodeEncounter,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  EncounterContent,
  GameState,
  GatheringContent,
  TravelState,
  WorldNodeEntry,
} from '@interfaces';

function stateWithTravel(travel: TravelState): GameState {
  return { world: { travel } } as unknown as GameState;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('canPartyTravel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when idle and no blocking global effect is active', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Idle', path: [], ticksIntoStep: 0 }),
    );
    vi.mocked(isGlobalEffectActive).mockReturnValue(false);

    expect(canPartyTravel()).toBe(true);
  });

  it('is true while already traveling, so a redirect can be started', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Traveling', path: [], ticksIntoStep: 0 }),
    );
    vi.mocked(isGlobalEffectActive).mockReturnValue(false);

    expect(canPartyTravel()).toBe(true);
  });

  it('is false while Deaths Door or Healing is active', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Idle', path: [], ticksIntoStep: 0 }),
    );
    vi.mocked(isGlobalEffectActive).mockImplementation(
      (id) => id === 'Deaths Door',
    );

    expect(canPartyTravel()).toBe(false);
  });
});

describe('travelStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Idle', path: [], ticksIntoStep: 0 }),
    );
    vi.mocked(isGlobalEffectActive).mockReturnValue(false);
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });
  });

  it('refuses to start when the party cannot travel', () => {
    vi.mocked(isGlobalEffectActive).mockReturnValue(true);

    expect(travelStart('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('refuses to start when no path exists', () => {
    vi.mocked(travelPathTo).mockReturnValue(undefined);
    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'Kingdom'
        ? [{ mapName: 'Carrina', x: 5, y: 5 } as unknown as WorldNodeEntry]
        : [],
    );

    expect(travelStart('Field Ruins')).toBe(false);
  });

  it('recalls the party to the kingdom and logs the error when pathfinding fails entirely', () => {
    vi.mocked(travelPathTo).mockReturnValue(undefined);
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'CraggledMire',
      x: 3,
      y: 7,
    });
    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'Kingdom'
        ? [{ mapName: 'Carrina', x: 5, y: 5 } as unknown as WorldNodeEntry]
        : [],
    );

    expect(travelStart('Field Ruins')).toBe(false);

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    });
    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      destinationNodeName: 'Field Ruins',
      path: [{ kind: 'Move', mapName: 'CraggledMire', x: 4, y: 7 }],
      ticksIntoStep: 1,
    }));
    expect(result.world.travel).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
    expect(travelMessageLog).toHaveBeenCalledWith(
      'CraggledMire',
      'Pathing error: no route to Field Ruins could be found from CraggledMire (3, 7). The party was recalled to the kingdom.',
    );
  });

  it('still resets travel state and logs even when no Kingdom node exists', () => {
    vi.mocked(travelPathTo).mockReturnValue(undefined);
    vi.mocked(worldNodesOfType).mockReturnValue([]);

    expect(travelStart('Field Ruins')).toBe(false);

    expect(currentLocationSet).not.toHaveBeenCalled();
    expect(travelMessageLog).toHaveBeenCalled();
  });

  it('sets travel state to Traveling and logs departure', () => {
    const path = [{ kind: 'Move' as const, mapName: 'Carrina', x: 1, y: 0 }];
    vi.mocked(travelPathTo).mockReturnValue(path);

    expect(travelStart('Field Ruins')).toBe(true);

    const result = applyLastUpdate(stateWithTravel({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    }));
    expect(result.world.travel).toEqual({
      status: 'Traveling',
      destinationNodeName: 'Field Ruins',
      path,
      ticksIntoStep: 0,
    });
    expect(travelMessageLog).toHaveBeenCalledWith(
      'Carrina',
      'The party left for Field Ruins.',
    );
    expect(gatheringStop).toHaveBeenCalled();
  });

  it('redirects to a new destination while already traveling', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    const path = [{ kind: 'Move' as const, mapName: 'Carrina', x: -1, y: 0 }];
    vi.mocked(travelPathTo).mockReturnValue(path);

    expect(travelStart('Old Town')).toBe(true);

    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      destinationNodeName: 'Field Ruins',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
      ticksIntoStep: 2,
    }));
    expect(result.world.travel).toEqual({
      status: 'Traveling',
      destinationNodeName: 'Old Town',
      path,
      ticksIntoStep: 0,
    });
    expect(travelMessageLog).toHaveBeenCalledWith(
      'Carrina',
      'The party changed course for Old Town.',
    );
  });

  it('refuses to redirect to the destination already being traveled to', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );

    expect(travelStart('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('settles as arrived when redirecting back to the tile already stood on, mid-travel', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 1,
      }),
    );
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
      nodeName: 'Old Town',
      nodeData: {} as never,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);
    vi.mocked(worldNodeGathering).mockReturnValue(undefined);

    expect(travelStart('Old Town')).toBe(true);

    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
      ticksIntoStep: 1,
    }));
    expect(result.world.travel).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
    expect(travelMessageLog).toHaveBeenCalledWith(
      'Carrina',
      'The party has arrived at Old Town.',
    );
  });

  it('still refuses a zero-length path while idle, for a manual travel', () => {
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(travelStart('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('re-triggers the node for an auto-mode travel targeting the tile already stood on (regression: the party would otherwise just stop once the nearest eligible node was the one they were already at)', () => {
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
      nodeName: 'Field Ruins',
      nodeData: {} as never,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      id: 'enc-1',
    } as unknown as EncounterContent);

    expect(travelStart('Field Ruins', true)).toBe(true);

    expect(encounterStartFight).toHaveBeenCalledWith('enc-1', 0, 'Field Ruins');
  });

  it('turns off Auto Mode when a manual travel is started while it is enabled', () => {
    vi.mocked(autoModeIsEnabled).mockReturnValue(true);
    vi.mocked(travelPathTo).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
    ]);

    travelStart('Field Ruins');

    expect(autoModeToggle).toHaveBeenCalledWith(false);
  });

  it('does not touch Auto Mode when the travel is auto-mode-initiated', () => {
    vi.mocked(autoModeIsEnabled).mockReturnValue(true);
    vi.mocked(travelPathTo).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
    ]);

    travelStart('Field Ruins', true);

    expect(autoModeToggle).not.toHaveBeenCalled();
  });

  it('does not call Auto Mode toggle when Auto Mode is already off', () => {
    vi.mocked(autoModeIsEnabled).mockReturnValue(false);
    vi.mocked(travelPathTo).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
    ]);

    travelStart('Field Ruins');

    expect(autoModeToggle).not.toHaveBeenCalled();
  });
});

describe('travelBeginDeathsDoor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'CraggledMire',
      x: 3,
      y: 3,
    });
    vi.mocked(worldNodesOfType).mockImplementation((type) =>
      type === 'Kingdom'
        ? [{ mapName: 'Carrina' } as unknown as WorldNodeEntry]
        : [],
    );
  });

  it('does not touch travel state - it is a pure timer, not a walk home', () => {
    vi.mocked(mapHopsBetween).mockReturnValue(1);

    travelBeginDeathsDoor();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(currentLocationSet).not.toHaveBeenCalled();
  });

  it('grants Deaths Door for 10 seconds per map hop to the kingdom', () => {
    vi.mocked(mapHopsBetween).mockReturnValue(2);

    travelBeginDeathsDoor();

    expect(mapHopsBetween).toHaveBeenCalledWith('CraggledMire', 'Carrina');
    expect(addGlobalEffect).toHaveBeenCalledWith('Deaths Door', 20);
  });

  it('applies a 10 second minimum even when already on the kingdom map', () => {
    vi.mocked(mapHopsBetween).mockReturnValue(0);

    travelBeginDeathsDoor();

    expect(addGlobalEffect).toHaveBeenCalledWith('Deaths Door', 10);
  });

  it('logs that the party is awaiting recall', () => {
    vi.mocked(mapHopsBetween).mockReturnValue(0);

    travelBeginDeathsDoor();

    expect(travelMessageLog).toHaveBeenCalledWith(
      'CraggledMire',
      'The fallen party awaits recall to the kingdom.',
    );
  });
});

describe('travelProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 0,
      y: 0,
    });
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(worldNodeAt).mockReturnValue(undefined);
  });

  it('does nothing when idle', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Idle', path: [], ticksIntoStep: 0 }),
    );

    travelProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(currentLocationSet).not.toHaveBeenCalled();
  });

  it('accumulates ticks without moving until an off-path step cost is reached', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 1,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).not.toHaveBeenCalled();
    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
      ticksIntoStep: 1,
    }));
    expect(result.world.travel.ticksIntoStep).toBe(2);
  });

  it('completes an off-path step at the 3-tick cost, moving to the next tile', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [
          { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
          { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
        ],
        ticksIntoStep: 2,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [],
      ticksIntoStep: 0,
    }));
    expect(result.world.travel).toEqual({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 0 }],
      ticksIntoStep: 0,
    });
  });

  it('completes an on-path step at the 1-tick cost, moving to the next tile', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [
          { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
          { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
        ],
        ticksIntoStep: 0,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [],
      ticksIntoStep: 0,
    }));
    expect(result.world.travel).toEqual({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 0 }],
      ticksIntoStep: 0,
    });
  });

  it('completes a step onto an off-path node tile at the 1-tick cost, so arrival never stutters', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(worldNodeAt).mockImplementation((_mapName, x, y) =>
      x === 1 && y === 0
        ? ({ nodeName: 'Field Ruins' } as unknown as WorldNodeEntry)
        : undefined,
    );
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 0,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
  });

  it('completes a step off of an off-path node tile at the 1-tick cost, so departure never stutters', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
    vi.mocked(worldNodeAt).mockImplementation((_mapName, x, y) =>
      x === 1 && y === 0
        ? ({ nodeName: 'Field Ruins' } as unknown as WorldNodeEntry)
        : undefined,
    );
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Old Town',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 0 }],
        ticksIntoStep: 0,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'Carrina',
      x: 2,
      y: 0,
    });
  });

  it('still charges the off-path cost leaving an ordinary (non-node) path tile onto an off-path tile', () => {
    vi.mocked(currentLocationGet).mockReturnValue({
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
    // Origin (1,0) is on-path but not a node; destination (2,0) is neither -
    // the origin's own on-path status must not discount this step, or every
    // path -> off-path transition would be mispriced as cheap.
    vi.mocked(tileIsOnPath).mockImplementation(
      (_mapName, x, y) => x === 1 && y === 0,
    );
    vi.mocked(worldNodeAt).mockReturnValue(undefined);
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 0 }],
        ticksIntoStep: 1,
      }),
    );

    travelProcessTick();

    // With the (buggy) 1-tick cost this would already complete at tick 2;
    // the off-path 3-tick cost means it shouldn't yet.
    expect(currentLocationSet).not.toHaveBeenCalled();
    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 0 }],
      ticksIntoStep: 1,
    }));
    expect(result.world.travel.ticksIntoStep).toBe(2);
  });

  it('resolves a Teleport step instantly, in the same tick as the Move step before it', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'To Craggled Mire',
        path: [
          { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
          { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
        ],
        ticksIntoStep: 2,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenNthCalledWith(1, {
      mapName: 'Carrina',
      x: 1,
      y: 0,
    });
    expect(currentLocationSet).toHaveBeenNthCalledWith(2, {
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
    });

    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [],
      ticksIntoStep: 0,
    }));
    expect(result.world.travel).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
  });

  it('resolves a lone Teleport step immediately without waiting for a tick to accumulate', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'To Craggled Mire',
        path: [{ kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 }],
        ticksIntoStep: 0,
      }),
    );

    travelProcessTick();

    expect(currentLocationSet).toHaveBeenCalledWith({
      mapName: 'CraggledMire',
      x: 0,
      y: 0,
    });
  });

  it('on arrival at a node with an encounter, resets travel and starts the first fight', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Field Ruins',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    const encounter = { id: 'enc-1' } as unknown as EncounterContent;
    const node = {
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Field Ruins',
      nodeData: {} as never,
    };
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(worldNodeEncounter).mockReturnValue(encounter);

    travelProcessTick();

    const result = applyLastUpdate(stateWithTravel({
      status: 'Traveling',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
      ticksIntoStep: 2,
    }));
    expect(result.world.travel).toEqual({
      status: 'Idle',
      path: [],
      ticksIntoStep: 0,
    });
    expect(travelMessageLog).toHaveBeenCalledWith(
      'Carrina',
      'The party has arrived at Field Ruins.',
    );
    expect(encounterStartFight).toHaveBeenCalledWith('enc-1', 0, 'Field Ruins');
    expect(mapNodeAutoShowOnArrival).toHaveBeenCalledWith(node);
  });

  it('on arrival at a node with no encounter, does not start a fight, but still shows the node', () => {
    const node = {
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Duchy of Carrina',
      nodeData: {} as never,
    };
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Duchy of Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);

    travelProcessTick();

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(gatheringStart).not.toHaveBeenCalled();
    // Arrival always surfaces wherever the party ends up, not just when
    // something (combat/gathering) kicks off there - see `mapNodeAutoShowOnArrival`.
    expect(mapNodeAutoShowOnArrival).toHaveBeenCalledWith(node);
  });

  it('on arrival at a node with a gathering site and no encounter, starts gathering and shows the node', () => {
    const node = {
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Wergen Woods',
      nodeData: {} as never,
    };
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Wergen Woods',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);
    vi.mocked(worldNodeGathering).mockReturnValue(
      { id: 'gather-1' } as unknown as GatheringContent,
    );

    travelProcessTick();

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(gatheringStart).toHaveBeenCalledWith('Wergen Woods');
    expect(gatherNodeDiscover).toHaveBeenCalledWith('Wergen Woods');
    expect(mapNodeAutoShowOnArrival).toHaveBeenCalledWith(node);
  });
});
