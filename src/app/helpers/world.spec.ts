import type { CurrentLocation, GameState } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(),
}));

import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  currentLocationGet,
  currentLocationSet,
  isPlayerAtKingdom,
  isPlayerAtLocation,
} from '@helpers/world';
import { worldNodeAt } from '@helpers/world-node/world-nodes';

describe('World Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('currentLocationGet', () => {
    it('should return the current location from state', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 24, y: 24 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);

      expect(currentLocationGet()).toEqual(location);
    });
  });

  describe('currentLocationSet', () => {
    it('should update the current location in state', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 10, y: 5 };

      currentLocationSet(location);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { currentLocation: { mapName: 'Carrina', x: 24, y: 24 } },
      } as unknown as GameState);

      expect(result.world.currentLocation).toEqual(location);
    });
  });

  describe('isPlayerAtLocation', () => {
    it('should report true when a node exists at the current location', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 24, y: 24 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);
      vi.mocked(worldNodeAt).mockReturnValue({
        mapName: 'Carrina',
        x: 24,
        y: 24,
        nodeName: 'Duchy of Carrina',
        nodeData: {} as never,
      });

      expect(isPlayerAtLocation()).toBe(true);
      expect(worldNodeAt).toHaveBeenCalledWith('Carrina', 24, 24);
    });

    it('should report false when no node exists at the current location', () => {
      const location: CurrentLocation = { mapName: 'Carrina', x: 1, y: 1 };

      vi.mocked(gamestate).mockReturnValue({
        world: { currentLocation: location },
      } as unknown as GameState);
      vi.mocked(worldNodeAt).mockReturnValue(undefined);

      expect(isPlayerAtLocation()).toBe(false);
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
