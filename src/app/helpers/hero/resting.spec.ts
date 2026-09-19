import type {
  Character,
  CharacterId,
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/gathering', () => ({
  isGathering: vi.fn(() => false),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  addGlobalEffect: vi.fn(),
  isGlobalEffectActive: vi.fn(() => false),
  removeGlobalEffect: vi.fn(),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldTravelState: () => gamestate().world.travel,
    worldCombatState: vi.fn(() => undefined),
  };
});

import { getEntry } from '@helpers/content/content';
import { deepFreeze } from '@helpers/engine/deep-freeze';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isPartyResting, restingProcessTick } from '@helpers/hero/resting';
import { isGathering } from '@helpers/item/gathering';
import {
  gamestate,
  updateGamestate,
  worldCombatState,
} from '@helpers/state-game';

const idleId = 'idle-1' as GlobalEffectId;
const idleContent: GlobalEffectContent = {
  id: idleId,
  name: 'Idle',
  __type: 'globaleffect',
  description: 'Heroes are idle and resting.',
  sprite: '0000',
  effects: [],
};

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1' as CharacterId,
    name: 'Hero',
    level: 1,
    xp: { current: 0, maximum: 100 },
    jobId: 'job-1' as JobId,
    jobProgress: {},
    hp: 50,
    ep: 20,
    stats: { Health: 100, Energy: 40 } as Character['stats'],
    equipment: {} as Character['equipment'],
    traitIds: [],
    ...overrides,
  } as Character;
}

function mockState(
  party: Character[],
  travelStatus: 'Idle' | 'Traveling' = 'Idle',
): void {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      travel: { status: travelStatus, path: [], ticksIntoStep: 0 },
      party,
    },
  } as unknown as GameState);
}

function applyLastUpdate(state: GameState): GameState {
  deepFreeze(state.world.party);

  const calls = vi.mocked(updateGamestate).mock.calls;
  return calls[calls.length - 1][0](state);
}

describe('Resting Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldCombatState).mockReturnValue(undefined);
    vi.mocked(isGathering).mockReturnValue(false);
    vi.mocked(isGlobalEffectActive).mockReturnValue(false);
    vi.mocked(getEntry).mockReturnValue(idleContent);
  });

  describe('isPartyResting', () => {
    it('is true when idle, not gathering, not in combat, and no blocking global effect', () => {
      mockState([]);

      expect(isPartyResting()).toBe(true);
    });

    it('is false while traveling', () => {
      mockState([], 'Traveling');

      expect(isPartyResting()).toBe(false);
    });

    it('is false while gathering', () => {
      mockState([]);
      vi.mocked(isGathering).mockReturnValue(true);

      expect(isPartyResting()).toBe(false);
    });

    it('is false while in combat', () => {
      mockState([]);
      vi.mocked(worldCombatState).mockReturnValue(
        {} as ReturnType<typeof worldCombatState>,
      );

      expect(isPartyResting()).toBe(false);
    });

    it('is false while Deaths Door or Healing is active', () => {
      mockState([]);
      vi.mocked(isGlobalEffectActive).mockReturnValue(true);

      expect(isPartyResting()).toBe(false);
    });
  });

  describe('restingProcessTick', () => {
    it('grants the Idle global effect when resting begins', () => {
      mockState([buildCharacter()]);
      vi.mocked(isGlobalEffectActive).mockReturnValue(false);

      restingProcessTick();

      expect(addGlobalEffect).toHaveBeenCalledWith('Idle', expect.any(Number));
      expect(removeGlobalEffect).not.toHaveBeenCalled();
    });

    it('does not re-grant the Idle effect on every tick once it is active', () => {
      mockState([buildCharacter()]);
      vi.mocked(isGlobalEffectActive).mockImplementation((id) => id === 'Idle');

      restingProcessTick();

      expect(addGlobalEffect).not.toHaveBeenCalled();
    });

    it('revokes the Idle global effect once the party stops resting', () => {
      mockState([buildCharacter()], 'Traveling');
      vi.mocked(isGlobalEffectActive).mockImplementation((id) => id === 'Idle');

      restingProcessTick();

      expect(removeGlobalEffect).toHaveBeenCalledWith(idleId);
    });

    it('does nothing to HP/EP when the party is not resting', () => {
      mockState([buildCharacter()], 'Traveling');

      restingProcessTick();

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('regenerates hp/ep by at least 1% of max, minimum 1', () => {
      mockState([buildCharacter({ hp: 50, ep: 20 })]);

      restingProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [buildCharacter({ hp: 50, ep: 20 })] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(51);
      expect(result.world.party[0].ep).toBe(21);
    });

    it('reassigns the party and only the characters that regenerated', () => {
      const rested = buildCharacter({
        id: 'a' as CharacterId,
        hp: 100,
        ep: 40,
      });
      const hurt = buildCharacter({ id: 'b' as CharacterId, hp: 50, ep: 20 });
      mockState([rested, hurt]);

      restingProcessTick();

      const state = {
        world: { party: [rested, hurt] },
      } as unknown as GameState;
      const previousParty = state.world.party;
      const result = applyLastUpdate(state);

      expect(result.world.party).not.toBe(previousParty);
      expect(result.world.party[0]).toBe(rested);
      expect(result.world.party[1]).not.toBe(hurt);
    });

    it('leaves the party reference untouched when nobody has anything to regenerate', () => {
      const rested = buildCharacter({ hp: 100, ep: 40 });
      mockState([rested]);

      restingProcessTick();

      const state = { world: { party: [rested] } } as unknown as GameState;
      const previousParty = state.world.party;
      const result = applyLastUpdate(state);

      expect(result.world.party).toBe(previousParty);
    });

    it('regen never exceeds the stat maximum', () => {
      mockState([buildCharacter({ hp: 100, ep: 40 })]);

      restingProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: { party: [buildCharacter({ hp: 100, ep: 40 })] },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(100);
      expect(result.world.party[0].ep).toBe(40);
    });

    it('enforces a minimum of 1 point even when 1% rounds to 0', () => {
      mockState([
        buildCharacter({
          hp: 1,
          ep: 1,
          stats: { Health: 10, Energy: 10 } as Character['stats'],
        }),
      ]);

      restingProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        world: {
          party: [
            buildCharacter({
              hp: 1,
              ep: 1,
              stats: { Health: 10, Energy: 10 } as Character['stats'],
            }),
          ],
        },
      } as unknown as GameState);

      expect(result.world.party[0].hp).toBe(2);
      expect(result.world.party[0].ep).toBe(2);
    });
  });
});
