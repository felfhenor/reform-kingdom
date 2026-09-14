import type {
  CollectibleContent,
  CollectibleId,
  GameState,
  GlobalEffect,
  GlobalEffectEffect,
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
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  globalEffectEffectsDescription,
  recomputeGlobalEffectSums,
} from '@helpers/hero/global-effect-state';

describe('globalEffectEffectsDescription', () => {
  it('renders every effect type as a comma-joined "Label: +N[%]" string', () => {
    const effects: GlobalEffectEffect[] = [
      { effectType: 'GainStats', stat: 'Strength', value: 5 },
      { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
      { effectType: 'GainCombatStat', combatStat: 'agroValue', value: 3 },
      { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
      { effectType: 'DebuffResistance', value: 10 },
      { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
      { effectType: 'GlobalGatheringItemDropRateBoost', value: 20 },
      { effectType: 'GlobalArmorySizeBoost', value: 5 },
    ];

    expect(globalEffectEffectsDescription(effects)).toBe(
      'Hero Combat Strength: +5, Hero Combat Revive Chance: +2%, Hero Combat Aggro: +3, XP Gain: +10%, All Debuff Resist: +10%, Accuracy Down Resist: +5%, Extra Gather Item Chance: +20%, Armory Size: +5',
    );
  });

  it('returns an empty string for an empty effect list', () => {
    expect(globalEffectEffectsDescription([])).toBe('');
  });
});

describe('recomputeGlobalEffectSums', () => {
  const satchelId = 'satchel' as CollectibleId;
  const satchel: CollectibleContent = {
    id: satchelId,
    name: "Adventurer's Satchel",
    __type: 'collectible',
    description: '',
    sprite: '0000',
    rarity: 'Uncommon',
    effects: [{ effectType: 'GlobalArmorySizeBoost', value: 5 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timerTicksElapsed).mockReturnValue(1000);
    vi.mocked(getEntry).mockImplementation((id) =>
      id === satchelId ? (satchel as never) : undefined,
    );
  });

  function buildState(overrides: Partial<GameState> = {}): GameState {
    return {
      globalEffects: [],
      collectibles: {},
      ...overrides,
    } as unknown as GameState;
  }

  it('sums active global effect entries by type', () => {
    const effect = {
      id: 'buff' as GlobalEffectId,
      expiresAtTick: 2000,
      effects: [
        { effectType: 'GainStats', stat: 'Strength', value: 5 },
        { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
      ],
    } as GlobalEffect;
    const state = buildState({ globalEffects: [effect] });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.stats.Strength).toBe(5);
    expect(state.globalEffectSums.xpGainMultiplierBonus).toBe(0.1);
  });

  it('excludes expired global effects', () => {
    const expired = {
      id: 'buff' as GlobalEffectId,
      expiresAtTick: 500,
      effects: [{ effectType: 'GainStats', stat: 'Strength', value: 5 }],
    } as GlobalEffect;
    const state = buildState({ globalEffects: [expired] });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.stats.Strength).toBe(0);
  });

  it("sums each owned collectible's effects exactly once, regardless of quantity", () => {
    const state = buildState({
      collectibles: { [satchelId]: { quantity: 11, foundAt: 0 } },
    });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.armorySizeBoost).toBe(5);
  });

  it('skips a collectible id that no longer resolves to real content', () => {
    const state = buildState({
      collectibles: {
        ['missing' as CollectibleId]: { quantity: 1, foundAt: 0 },
      },
    });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.armorySizeBoost).toBe(0);
  });

  it('combines active global effects and owned collectible effects together', () => {
    const effect = {
      id: 'buff' as GlobalEffectId,
      expiresAtTick: 2000,
      effects: [{ effectType: 'GlobalArmorySizeBoost', value: 3 }],
    } as GlobalEffect;
    const state = buildState({
      globalEffects: [effect],
      collectibles: { [satchelId]: { quantity: 1, foundAt: 0 } },
    });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.armorySizeBoost).toBe(8);
  });
});
