import { beforeEach, describe, expect, it } from 'vitest';

import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureCollectible } from '@helpers/content/ensure-item';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { defaultGameState } from '@helpers/defaults';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectPush,
  applyGlobalEffectRemove,
  globalEffectEffectsDescription,
  recomputeGlobalEffectSums,
} from '@helpers/hero/global-effect-state';
import type {
  CollectibleId,
  GameState,
  GlobalEffect,
  GlobalEffectEffect,
  GlobalEffectId,
  TradeskillId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const now = 1000;
const jewelcrafting = ensureTradeskill({
  id: 'jewelcrafting' as TradeskillId,
  name: 'Jewelcrafting',
});
const satchel = ensureCollectible({
  id: 'satchel' as CollectibleId,
  name: 'Satchel',
  effects: [{ effectType: 'GlobalArmorySizeBoost', value: 5 }],
});
const blessing = ensureGlobalEffect({
  id: 'blessing' as GlobalEffectId,
  name: 'Blessing',
  effects: [{ effectType: 'GainStats', stat: 'Strength', value: 5 }],
});

function active(
  effects: GlobalEffectEffect[],
  expiresAtTick = now + 1,
): GlobalEffect {
  return { ...blessing, effects, startTick: 0, expiresAtTick };
}

// Recompute reads the live clock, but mutates whichever state it is handed.
function freshState(edit: (state: GameState) => void = () => undefined) {
  const state = defaultGameState();
  edit(state);
  return state;
}

beforeEach(() => {
  seedContent([jewelcrafting, satchel, blessing]);
  seedGamestate((state) => (state.clock.numTicks = now));
});

describe('globalEffectEffectsDescription', () => {
  it('renders each effect as a comma-joined "Label: +N[%]" fragment', () => {
    expect(
      globalEffectEffectsDescription([
        { effectType: 'GainStats', stat: 'Strength', value: 5 },
        { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
        { effectType: 'GainCombatStat', combatStat: 'agroValue', value: 3 },
        { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
        { effectType: 'GlobalGoldGainMultiplier', value: 0.2 },
        { effectType: 'DebuffResistance', value: 10 },
        { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
        { effectType: 'GlobalCombatItemDropRateBoost', value: 15 },
        { effectType: 'GlobalGatheringItemDropRateBoost', value: 20 },
        { effectType: 'GlobalArmorySizeBoost', value: 5 },
        {
          effectType: 'GlobalTradeskillQueueSizeBoost',
          tradeskillId: jewelcrafting.id,
          value: 1,
        },
        {
          effectType: 'GlobalTradeskillQueueSizeBoost',
          tradeskillId: 'gone' as TradeskillId,
          value: 1,
        },
        { effectType: 'GlobalOffPathTravelSpeedBoost', value: 0.1 },
        { effectType: 'GlobalOnPathTravelSpeedBoost', value: 0.05 },
        { effectType: 'GlobalDecreeClauseCapBoost', value: 1 },
      ]),
    ).toBe(
      [
        'Hero Strength: +5',
        'Hero Revive Chance: +2%',
        'Hero Aggro: +3',
        'XP Gain: +10%',
        'Gold Gain: +20%',
        'All Debuff Resist: +10%',
        'Accuracy Down Resist: +5%',
        'Item Drop Chance: +15%',
        'Extra Gather Item Chance: +20%',
        'Armory Size: +5',
        'Jewelcrafting Queue Size: +1',
        'Unknown Tradeskill Queue Size: +1',
        'Off-Path Travel Speed: +10%',
        'On-Path Travel Speed: +5%',
        'Decree Clause Cap: +1',
      ].join(', '),
    );
  });
});

describe('recomputeGlobalEffectSums', () => {
  it('sums every effect type from active effects into its matching total', () => {
    const state = freshState((s) => {
      s.globalEffects = [
        active([
          { effectType: 'GainStats', stat: 'Strength', value: 5 },
          {
            effectType: 'GainCombatStat',
            combatStat: 'reviveChance',
            value: 2,
          },
          { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
          { effectType: 'GlobalGoldGainMultiplier', value: 0.2 },
          { effectType: 'DebuffResistance', value: 3 },
          { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 4 },
          { effectType: 'GlobalCombatItemDropRateBoost', value: 6 },
          { effectType: 'GlobalGatheringItemDropRateBoost', value: 7 },
          { effectType: 'GlobalArmorySizeBoost', value: 8 },
          {
            effectType: 'GlobalTradeskillQueueSizeBoost',
            tradeskillId: jewelcrafting.id,
            value: 1,
          },
          {
            effectType: 'GlobalTradeskillQueueSizeBoost',
            tradeskillId: jewelcrafting.id,
            value: 2,
          },
          { effectType: 'GlobalOffPathTravelSpeedBoost', value: 0.1 },
          { effectType: 'GlobalOnPathTravelSpeedBoost', value: 0.05 },
          { effectType: 'GlobalDecreeClauseCapBoost', value: 1 },
        ]),
      ];
    });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums).toMatchObject({
      stats: expect.objectContaining({ Strength: 5 }),
      combatStats: expect.objectContaining({ reviveChance: 2 }),
      xpGainMultiplierBonus: 0.1,
      goldGainMultiplierBonus: 0.2,
      debuffResistanceFlat: 3,
      debuffResistanceTags: expect.objectContaining({ Accuracy: 4 }),
      combatItemDropRateBoost: 6,
      gatheringItemDropRateBoost: 7,
      armorySizeBoost: 8,
      tradeskillQueueSizeBoosts: { [jewelcrafting.id]: 3 },
      offPathTravelSpeedBonus: 0.1,
      onPathTravelSpeedBonus: 0.05,
      decreeClauseCapBoost: 1,
    });
  });

  it('adds owned collectibles once each, skipping expired effects and removed content', () => {
    const state = freshState((s) => {
      s.globalEffects = [
        active([{ effectType: 'GlobalArmorySizeBoost', value: 3 }]),
        active([{ effectType: 'GlobalArmorySizeBoost', value: 100 }], now),
      ];
      s.collectibles = {
        [satchel.id]: { quantity: 11, foundAt: 0 },
        ['gone' as CollectibleId]: { quantity: 1, foundAt: 0 },
      };
    });

    recomputeGlobalEffectSums(state);

    expect(state.globalEffectSums.armorySizeBoost).toBe(3 + 5);
  });
});

describe('adding and removing effects', () => {
  it('starts an effect from its content and keeps the sums in step', () => {
    const state = freshState();

    applyGlobalEffectAdd(state, blessing.id, 30, now);
    expect(state.globalEffects).toEqual([
      expect.objectContaining({
        id: blessing.id,
        startTick: now,
        expiresAtTick: now + 30,
      }),
    ]);
    expect(state.globalEffectSums.stats.Strength).toBe(5);

    applyGlobalEffectRemove(state, blessing.id);
    expect(state.globalEffects).toEqual([]);
    expect(state.globalEffectSums.stats.Strength).toBe(0);
  });

  it('adds nothing for unknown content, and pushes ready-made effects as-is', () => {
    const state = freshState();

    applyGlobalEffectAdd(state, 'gone' as GlobalEffectId, 30, now);
    expect(state.globalEffects).toEqual([]);

    const effect = active([{ effectType: 'DebuffResistance', value: 2 }]);
    applyGlobalEffectPush(state, effect);
    expect(state.globalEffects).toEqual([effect]);
    expect(state.globalEffectSums.debuffResistanceFlat).toBe(2);
  });
});
