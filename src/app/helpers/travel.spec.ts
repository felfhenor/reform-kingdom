import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@helpers/gathering', () => ({
  gatheringStart: vi.fn(),
  gatheringStop: vi.fn(),
}));

vi.mock('@helpers/pathfinding', () => ({
  mapHopsBetween: vi.fn(() => 0),
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

vi.mock('@helpers/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeEncounter: vi.fn(),
  worldNodeGathering: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

import { addGlobalEffect, isGlobalEffectActive } from '@helpers/global-effects';
import { encounterStartFight } from '@helpers/encounter';
import { travelMessageLog } from '@helpers/combat-log';
import { gatheringStart, gatheringStop } from '@helpers/gathering';
import { mapHopsBetween, travelPathTo } from '@helpers/pathfinding';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  canPartyTravel,
  travelBeginDeathsDoor,
  travelProcessTick,
  travelStart,
} from '@helpers/travel';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
import {
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

  it('is false while already traveling', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Traveling', path: [], ticksIntoStep: 0 }),
    );

    expect(canPartyTravel()).toBe(false);
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

    expect(travelStart('Field Ruins')).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
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
  });

  it('does nothing when idle', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({ status: 'Idle', path: [], ticksIntoStep: 0 }),
    );

    travelProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(currentLocationSet).not.toHaveBeenCalled();
  });

  it('accumulates ticks without moving until the step cost is reached', () => {
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

  it('completes a step at the 3-tick cost, moving to the next tile', () => {
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
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Field Ruins',
      nodeData: {} as never,
    });
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
  });

  it('on arrival at a node with no encounter, does not start a fight', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Duchy of Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Duchy of Carrina',
      nodeData: {} as never,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);

    travelProcessTick();

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(gatheringStart).not.toHaveBeenCalled();
  });

  it('on arrival at a node with a gathering site and no encounter, starts gathering', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithTravel({
        status: 'Traveling',
        destinationNodeName: 'Wergen Woods',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      }),
    );
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 1,
      y: 0,
      nodeName: 'Wergen Woods',
      nodeData: {} as never,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);
    vi.mocked(worldNodeGathering).mockReturnValue(
      { id: 'gather-1' } as unknown as GatheringContent,
    );

    travelProcessTick();

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(gatheringStart).toHaveBeenCalledWith('Wergen Woods');
  });
});
