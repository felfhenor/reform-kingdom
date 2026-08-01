import type { GameState, GlobalEffectContent, GlobalEffectId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  activeGlobalEffects,
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/global-effects';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';

describe('Global Effect Helper Functions', () => {
  const healingId = 'healing-1' as GlobalEffectId;

  const healingContent: GlobalEffectContent = {
    id: healingId,
    name: 'Healing',
    __type: 'globaleffect',
    description: 'The party is recovering.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activeGlobalEffects', () => {
    it('should only return effects that have not yet expired', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(10);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [
          { ...healingContent, startTick: 0, expiresAtTick: 20 },
          {
            ...healingContent,
            id: 'expired' as GlobalEffectId,
            name: 'Expired',
            startTick: 0,
            expiresAtTick: 5,
          },
        ],
      } as unknown as GameState);

      const active = activeGlobalEffects();

      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Healing');
    });
  });

  describe('isGlobalEffectActive', () => {
    it('should return true when a matching active effect exists', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(10);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...healingContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      expect(isGlobalEffectActive(healingId)).toBe(true);
      expect(isGlobalEffectActive('unknown' as GlobalEffectId)).toBe(false);
    });
  });

  describe('addGlobalEffect', () => {
    it('should push a new effect built from content, using the content id', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(10);
      vi.mocked(getEntry).mockReturnValue(healingContent);

      addGlobalEffect(healingId, 30);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        globalEffects: [],
      } as unknown as GameState);

      expect(result.globalEffects).toEqual([
        {
          ...healingContent,
          startTick: 10,
          expiresAtTick: 40,
        },
      ]);
    });

    it('should do nothing when the referenced content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      addGlobalEffect(healingId, 30);

      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });

  describe('removeGlobalEffect', () => {
    it('should remove the effect matching the given id', () => {
      removeGlobalEffect(healingId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        globalEffects: [
          { ...healingContent, startTick: 0, expiresAtTick: 20 },
          {
            ...healingContent,
            id: 'other' as GlobalEffectId,
            name: 'Other',
            startTick: 0,
            expiresAtTick: 20,
          },
        ],
      } as unknown as GameState);

      expect(result.globalEffects).toHaveLength(1);
      expect(result.globalEffects[0].id).toBe('other');
    });
  });
});
