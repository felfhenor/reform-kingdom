import { beforeEach, describe, expect, it } from 'vitest';

import { RESTING_REGEN_PERCENT } from '@helpers/config';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { defaultStats } from '@helpers/defaults';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import { isPartyResting, restingProcessTick } from '@helpers/hero/resting';
import { globalEffectsState, worldPartyState } from '@helpers/state-game';
import type { Character, GameState, GlobalEffectId } from '@interfaces';
import { buildCharacter, buildCombat } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const [idle, healing, deathsDoor] = ['Idle', 'Healing', 'Deaths Door'].map(
  (name) => ensureGlobalEffect({ id: `${name}-id` as GlobalEffectId, name }),
);

function hero(overrides: Partial<Character> = {}): Character {
  return buildCharacter({
    stats: { ...defaultStats(), Health: 100, Energy: 40 },
    hp: 50,
    ep: 20,
    ...overrides,
  });
}

function seedParty(
  party: Character[],
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.world.party = party;
    edit(state);
  });
}

function withEffect(id: GlobalEffectId) {
  return (state: GameState) => applyGlobalEffectAdd(state, id, 100, 0);
}

const tick = () => inTick(restingProcessTick);

function idleEffects(): number {
  return globalEffectsState().filter(({ id }) => id === idle.id).length;
}

// The regen formula, so tests read in terms of a tick's worth of rest.
function rested(current: number, max: number, boost = 0): number {
  return Math.min(
    max,
    current +
      Math.floor(boost) +
      Math.max(1, Math.round(max * RESTING_REGEN_PERCENT)),
  );
}

beforeEach(() => {
  seedContent([idle, healing, deathsDoor]);
});

describe('isPartyResting', () => {
  it('rests only with nothing else going on', () => {
    seedParty([]);
    expect(isPartyResting()).toBe(true);

    [
      (state: GameState) => (state.world.travel.status = 'Traveling'),
      (state: GameState) => (state.world.gathering.status = 'Gathering'),
      (state: GameState) => (state.world.combat = buildCombat()),
      withEffect(healing.id),
      withEffect(deathsDoor.id),
    ].forEach((busy) => {
      seedParty([], busy);
      expect(isPartyResting()).toBe(false);
    });
  });
});

describe('restingProcessTick', () => {
  it('regenerates hp/ep by a share of max, plus Constitution/Spirit', () => {
    seedParty([
      hero({
        stats: {
          ...defaultStats(),
          Health: 100,
          Energy: 40,
          Constitution: 2.5,
          Spirit: 1,
        },
      }),
    ]);

    tick();

    expect(worldPartyState()[0]).toMatchObject({
      hp: rested(50, 100, 2.5),
      ep: rested(20, 40, 1),
    });
  });

  it('always regenerates at least 1, never past max, and leaves an over-max pool alone', () => {
    // Small enough that its regen share rounds to 0, whatever the configured percent.
    const tinyMax = Math.max(2, Math.floor(0.49 / RESTING_REGEN_PERCENT));
    seedParty([
      hero({
        stats: { ...defaultStats(), Health: tinyMax, Energy: 10, Spirit: 5 },
        hp: 1,
        ep: 9,
      }),
      hero({ stats: { ...defaultStats(), Health: 10, Energy: 10 }, hp: 12 }),
    ]);

    tick();

    expect(worldPartyState()[0]).toMatchObject({ hp: 2, ep: 10 });
    expect(worldPartyState()[1].hp).toBe(12);
  });

  it('leaves the party slice untouched once everyone is fully rested', () => {
    const full = hero({ hp: 100, ep: 40 });
    seedParty([full]);
    tick();
    const party = worldPartyState();

    tick();

    expect(worldPartyState()).toBe(party);
  });

  it('keeps one Idle effect while resting, dropping it once the party is busy', () => {
    seedParty([hero()]);

    tick();
    tick();
    expect(idleEffects()).toBe(1);

    seedParty([hero()], (state) => {
      withEffect(idle.id)(state);
      state.world.travel.status = 'Traveling';
    });
    tick();

    expect(idleEffects()).toBe(0);
    expect(worldPartyState()[0].hp).toBe(50);
  });
});
