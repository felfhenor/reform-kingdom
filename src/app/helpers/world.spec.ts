import type { CurrentLocation, GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldCurrentLocationState: () => gamestate().world.currentLocation,
  };
});

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(),
}));

import { deepFreeze } from '@helpers/engine/deep-freeze';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { currentLocationSet, isPlayerAtKingdom } from '@helpers/world';
import { worldNodeAt } from '@helpers/world-node/world-nodes';

describe('World Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('currentLocationSet', () => {
    it('should update the current location in state', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 10, y: 5 };

      currentLocationSet(location);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = {
        world: { currentLocation: { mapName: 'Carrina', x: 24, y: 24 } },
      } as unknown as GameState;
      const previousLocation = deepFreeze(state.world.currentLocation);
      const result = updateFn(state);

      expect(result.world.currentLocation).toEqual(location);
      expect(result.world.currentLocation).not.toBe(previousLocation);
    });
  });

  describe('isPlayerAtKingdom', () => {
    it('should report true when the node at the current location is a Kingdom', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 24, y: 24 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);
      vi.mocked(worldNodeAt).mockReturnValue({
        mapName: 'Carrina',
        x: 24,
        y: 24,
        nodeName: 'Duchy of Carrina',
        nodeData: { type: 'Kingdom' } as never,
      });

      expect(isPlayerAtKingdom()).toBe(true);
    });

    it('should report false when the node at the current location is not a Kingdom', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 1, y: 24 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);
      vi.mocked(worldNodeAt).mockReturnValue({
        mapName: 'Carrina',
        x: 1,
        y: 24,
        nodeName: 'Forest Ruins',
        nodeData: { type: 'ExploreNode' } as never,
      });

      expect(isPlayerAtKingdom()).toBe(false);
    });

    it('should report false when there is no node at the current location', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 1, y: 1 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);
      vi.mocked(worldNodeAt).mockReturnValue(undefined);

      expect(isPlayerAtKingdom()).toBe(false);
    });
  });
});
