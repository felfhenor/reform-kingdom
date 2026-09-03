import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel', () => ({
  travelStepTicksCost: vi.fn(() => 5),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/town-gold', () => ({
  applyTownAccrueHiddenGold: vi.fn(),
}));

vi.mock('@helpers/town/town-materials', () => ({
  applyTownMaterialDelta: vi.fn(),
}));

import { travelStepTicksCost } from '@helpers/hero/travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { applyTownAccrueHiddenGold } from '@helpers/town/town-gold';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  TOWN_WORKER_REST_TICKS,
  townWorkerRestProcessTick,
  townWorkerTravelProcessTick,
} from '@helpers/town/worker/town-worker-travel-tick';
import type {
  GameState,
  ItemId,
  TownContent,
  TownId,
  WorkerId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;

function buildTown(): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    gathering: { goldGatheredPerMaterial: 5 },
  } as unknown as TownContent;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townWorkerTravelProcessTick', () => {
  it('transitions TravelingTo to Gathering on arrival (single-step path)', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(1);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                location: { mapName: 'Carrina', x: 5, y: 5 },
                status: {
                  kind: 'TravelingTo',
                  nodeName: 'Wergen Woods',
                  itemId: oreId,
                  path: [{ kind: 'Move', mapName: 'Carrina', x: 6, y: 5 }],
                  ticksIntoStep: 0,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    townWorkerTravelProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'TravelingTo',
                  path: [],
                  ticksIntoStep: 0,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(
      state.world.towns[townId].workers[workerId].status,
    ).toMatchObject({
      kind: 'Gathering',
      nodeName: 'Wergen Woods',
      itemId: oreId,
      itemsGathered: 0,
    });
  });

  it('does not advance to Gathering mid-step', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(5);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                location: { mapName: 'Carrina', x: 5, y: 5 },
                status: {
                  kind: 'TravelingTo',
                  nodeName: 'Wergen Woods',
                  itemId: oreId,
                  path: [{ kind: 'Move', mapName: 'Carrina', x: 6, y: 5 }],
                  ticksIntoStep: 0,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    townWorkerTravelProcessTick(buildTown(), workerId);

    const calls = vi.mocked(updateGamestate).mock.calls;
    const state = calls[calls.length - 1][0]({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'TravelingTo',
                  path: [{ kind: 'Move', mapName: 'Carrina', x: 6, y: 5 }],
                  ticksIntoStep: 0,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(
      state.world.towns[townId].workers[workerId].status.kind,
    ).toBe('TravelingTo');
  });

  it('accrues hidden gold and rests on TravelingBack arrival', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(1);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                location: { mapName: 'Carrina', x: 6, y: 5 },
                status: {
                  kind: 'TravelingBack',
                  path: [{ kind: 'Move', mapName: 'Carrina', x: 5, y: 5 }],
                  ticksIntoStep: 0,
                  carriedItemId: oreId,
                  carriedQuantity: 4,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    townWorkerTravelProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: { kind: 'TravelingBack', path: [], ticksIntoStep: 0 },
                assignment: { nodeName: 'Wergen Woods', itemId: oreId },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    expect(applyTownAccrueHiddenGold).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      townId,
      20,
    );
    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      expect.anything(),
      townId,
      oreId,
      4,
    );
    expect(state.world.towns[townId].workers[workerId].status).toEqual({
      kind: 'Resting',
      ticksIntoRest: 0,
    });
    expect(state.world.towns[townId].workers[workerId].assignment).toBe(null);
  });
});

describe('townWorkerRestProcessTick', () => {
  it('increments ticksIntoRest while under the rest duration', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: { status: { kind: 'Resting', ticksIntoRest: 0 } },
            },
          },
        },
      },
    } as unknown as GameState);

    townWorkerRestProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: { status: { kind: 'Resting', ticksIntoRest: 0 } },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toEqual({
      kind: 'Resting',
      ticksIntoRest: 1,
    });
  });

  it('transitions to AtTown once the rest duration elapses', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'Resting',
                  ticksIntoRest: TOWN_WORKER_REST_TICKS - 1,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    townWorkerRestProcessTick(buildTown(), workerId);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: {
                status: {
                  kind: 'Resting',
                  ticksIntoRest: TOWN_WORKER_REST_TICKS - 1,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toEqual({
      kind: 'AtTown',
    });
  });
});
