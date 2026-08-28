import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { gamestate } from '@helpers/state-game';
import { workersTravelingTokens } from '@helpers/worker/worker-travel';
import type { GameState, WorkerId } from '@interfaces';

describe('workersTravelingTokens', () => {
  // Single read: `workersTravelingTokens` is a `computed()`, so a second call in this file
  // would replay this mock's cached result rather than re-invoking the mocked `gamestate()`.
  it('returns only TravelingTo/TravelingBack workers, mapped to their token fields', () => {
    const travelingToId = 'weaver-nell' as WorkerId;
    const travelingBackId = 'miner-joric' as WorkerId;
    const atDuchyId = 'idle-alma' as WorkerId;
    const gatheringId = 'gatherer-finn' as WorkerId;

    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [travelingToId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 0, y: 0 },
          status: {
            kind: 'TravelingTo',
            nodeName: 'Wergen Woods',
            itemId: 'copper-ore',
            path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
            ticksIntoStep: 2,
          },
          assignment: null,
        },
        [travelingBackId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 3, y: 3 },
          status: {
            kind: 'TravelingBack',
            path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
            ticksIntoStep: 1,
            carriedItemId: 'copper-ore',
            carriedQuantity: 5,
          },
          assignment: null,
        },
        [atDuchyId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Carrina', x: 0, y: 0 },
          status: { kind: 'AtDuchy' },
          assignment: null,
        },
        [gatheringId]: {
          level: 1,
          xp: { current: 0, maximum: 10 },
          location: { mapName: 'Wergen Woods', x: 5, y: 5 },
          status: {
            kind: 'Gathering',
            nodeName: 'Wergen Woods',
            itemId: 'copper-ore',
            itemsGathered: 2,
            ticksIntoGather: 3,
          },
          assignment: null,
        },
      },
    } as unknown as GameState);

    const tokens = workersTravelingTokens();

    expect(tokens).toEqual([
      {
        workerId: travelingToId,
        mapName: 'Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
        ticksIntoStep: 2,
      },
      {
        workerId: travelingBackId,
        mapName: 'Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
        ticksIntoStep: 1,
      },
    ]);
  });
});
