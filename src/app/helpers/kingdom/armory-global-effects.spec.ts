import type {
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 1000),
}));

import { getEntry } from '@helpers/content/content';
import { syncArmoryGlobalEffects } from '@helpers/kingdom/armory-global-effects';

function contentFor(name: string): GlobalEffectContent {
  return {
    id: `${name}-id` as GlobalEffectId,
    name,
    __type: 'globaleffect',
    description: name,
    sprite: '0000',
    effects: [],
    hideDuration: true,
  };
}

const encumbered = contentFor('Encumbered');
const overburdened = contentFor('Overburdened');
const overCapacity = contentFor('Over Capacity');
const encumberedId = encumbered.id;
const overburdenedId = overburdened.id;
const overCapacityId = overCapacity.id;

// `applyGlobalEffectAdd` re-resolves the id via `getEntry` itself, so the mock
// must answer consistently whether called with a name or an id.
const CONTENT_BY_KEY: Record<string, GlobalEffectContent> = {
  Encumbered: encumbered,
  [encumbered.id]: encumbered,
  Overburdened: overburdened,
  [overburdened.id]: overburdened,
  'Over Capacity': overCapacity,
  [overCapacity.id]: overCapacity,
};

function buildState(
  armorySize: number,
  activeIds: GlobalEffectId[] = [],
): GameState {
  return {
    armory: Array.from({ length: armorySize }),
    collectibles: {},
    globalEffects: activeIds.map((id) => ({
      id,
      effects: [],
      startTick: 0,
      expiresAtTick: 999999,
    })),
  } as unknown as GameState;
}

describe('syncArmoryGlobalEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockImplementation(
      (key) => CONTENT_BY_KEY[key] as never,
    );
  });

  it('activates nothing under the 75% Encumbered threshold', () => {
    const state = buildState(37); // 74%

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects).toEqual([]);
  });

  it('activates Encumbered at exactly 75%', () => {
    const state = buildState(38); // 76%

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects.map((e) => e.id)).toEqual([encumberedId]);
  });

  it('activates Overburdened at exactly 100%, not Encumbered', () => {
    const state = buildState(50);

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects.map((e) => e.id)).toEqual([overburdenedId]);
  });

  it('activates Over Capacity at exactly 125%', () => {
    const state = buildState(63); // 126%

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects.map((e) => e.id)).toEqual([overCapacityId]);
  });

  it('leaves an already-active tier untouched', () => {
    const state = buildState(50, [overburdenedId]);

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects.map((e) => e.id)).toEqual([overburdenedId]);
  });

  it('swaps tiers: removes the previous tier and adds the new one', () => {
    const state = buildState(63, [overburdenedId]); // now Over Capacity

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects.map((e) => e.id)).toEqual([overCapacityId]);
  });

  it('deactivates every tier once the armory drops back under 75%', () => {
    const state = buildState(10, [encumberedId]);

    syncArmoryGlobalEffects(state);

    expect(state.globalEffects).toEqual([]);
  });
});
