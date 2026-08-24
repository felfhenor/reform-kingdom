import type { GameState, GlobalEffectContent, GlobalEffectId } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/character-progress', () => ({
  healingTicksForLevel: vi.fn(() => 4),
  healPartyToFull: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/party', () => ({
  partyGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  currentLocationSet: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodesOfType: vi.fn(() => []),
}));

import { healPartyToFull } from '@helpers/character-progress';
import { getEntry } from '@helpers/content';
import {
  activeGlobalEffects,
  addGlobalEffect,
  globalEffectDurationLabel,
  globalEffectsProcessTick,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/global-effects';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import { currentLocationSet } from '@helpers/world';
import { worldNodesOfType } from '@helpers/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

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
      vi.mocked(getEntry).mockReturnValue(healingContent);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...healingContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      expect(isGlobalEffectActive(healingId)).toBe(true);
    });

    it('should return false when the id/name cannot be resolved to content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(isGlobalEffectActive('unknown' as GlobalEffectId)).toBe(false);
    });

    it('should return false when the resolved content has no active effect in state', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(10);
      vi.mocked(getEntry).mockReturnValue(healingContent);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [],
      } as unknown as GameState);

      expect(isGlobalEffectActive(healingId)).toBe(false);
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

  describe('globalEffectsProcessTick', () => {
    const deathsDoorId = 'deaths-door-1' as GlobalEffectId;
    const deathsDoorContent: GlobalEffectContent = {
      id: deathsDoorId,
      name: 'Deaths Door',
      __type: 'globaleffect',
      description: 'The fallen party awaits recall.',
    };

    function mockContentLookup(): void {
      vi.mocked(getEntry).mockImplementation((idOrName) => {
        if (idOrName === healingId || idOrName === 'Healing') return healingContent;
        if (idOrName === deathsDoorId || idOrName === 'Deaths Door') {
          return deathsDoorContent;
        }
        return undefined;
      });
    }

    // These are real functions (not mocked), so their effect is only observable via the `updateGamestate` updaters they pass along.
    function healingWasGranted(): boolean {
      return vi.mocked(updateGamestate).mock.calls.some(([updateFn]) => {
        const result = updateFn({ globalEffects: [] } as unknown as GameState);
        return result.globalEffects.some((effect) => effect.id === healingId);
      });
    }

    it('heals the party to full and removes the effect when Healing expires', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(20);
      mockContentLookup();
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...healingContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      globalEffectsProcessTick();

      expect(healPartyToFull).toHaveBeenCalled();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        globalEffects: [{ ...healingContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);
      expect(result.globalEffects).toHaveLength(0);
    });

    it('teleports the party to the kingdom and grants Healing when Deaths Door expires', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(20);
      mockContentLookup();
      vi.mocked(worldNodesOfType).mockImplementation((type) =>
        type === 'Kingdom'
          ? [
              {
                mapName: 'Carrina',
                x: 24,
                y: 24,
              } as unknown as WorldNodeEntry,
            ]
          : [],
      );
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...deathsDoorContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      globalEffectsProcessTick();

      expect(currentLocationSet).toHaveBeenCalledWith({
        mapName: 'Carrina',
        x: 24,
        y: 24,
      });
      expect(healingWasGranted()).toBe(true);
      expect(healPartyToFull).not.toHaveBeenCalled();
    });

    it('still removes an expired Deaths Door even when there is no Kingdom node', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(20);
      mockContentLookup();
      vi.mocked(worldNodesOfType).mockReturnValue([]);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...deathsDoorContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      globalEffectsProcessTick();

      expect(currentLocationSet).not.toHaveBeenCalled();
      expect(healingWasGranted()).toBe(true);
    });

    it('does nothing when no effects have expired', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(5);
      vi.mocked(gamestate).mockReturnValue({
        globalEffects: [{ ...healingContent, startTick: 0, expiresAtTick: 20 }],
      } as unknown as GameState);

      globalEffectsProcessTick();

      expect(healPartyToFull).not.toHaveBeenCalled();
      expect(updateGamestate).not.toHaveBeenCalled();
    });
  });

  describe('globalEffectDurationLabel', () => {
    it('formats remaining ticks as seconds, minutes, or hours', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(0);

      expect(
        globalEffectDurationLabel({ ...healingContent, startTick: 0, expiresAtTick: 30 }),
      ).toBe('30s');
      expect(
        globalEffectDurationLabel({ ...healingContent, startTick: 0, expiresAtTick: 900 }),
      ).toBe('15m');
      expect(
        globalEffectDurationLabel({ ...healingContent, startTick: 0, expiresAtTick: 3600 }),
      ).toBe('1h');
    });

    it('never returns a negative duration for an already-expired effect', () => {
      vi.mocked(timerTicksElapsed).mockReturnValue(100);

      expect(
        globalEffectDurationLabel({ ...healingContent, startTick: 0, expiresAtTick: 50 }),
      ).toBe('0s');
    });
  });
});
