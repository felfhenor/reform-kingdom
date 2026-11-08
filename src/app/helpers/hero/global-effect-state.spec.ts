import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureCollectible } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import { defaultGameState, defaultStats } from '@helpers/defaults';
import {
  applyGlobalEffectAdd,
  globalEffectDescription,
  globalEffectEffectsScaled,
  applyGlobalEffectPush,
  applyGlobalEffectRemove,
  globalEffectEffectsDescription,
  globalEffectSumsFor,
  recomputeGlobalEffectSums,
} from '@helpers/hero/global-effect-state';
import type {
  CollectibleId,
  EdictId,
  GameState,
  GlobalEffect,
  GlobalEffectEffect,
  GlobalEffectId,
  JobId,
  TradeskillId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
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

// Recompute reads the clock of the state it's handed, not the live one.
function freshState(edit: (state: GameState) => void = () => undefined) {
  const state = defaultGameState();
  state.clock.numTicks = now;
  edit(state);
  return state;
}

const might = ensureEdict({
  id: 'might' as EdictId,
  name: 'Might',
  effects: [{ effectType: 'GainStatPercent', value: 25 }],
});
const frailty = ensureEdict({
  id: 'frailty' as EdictId,
  name: 'Frailty',
  effects: [{ effectType: 'GainStatPercent', value: -25 }],
});
const fury = ensureEdict({
  id: 'fury' as EdictId,
  name: 'Fury',
  effects: [
    { effectType: 'EnemyStatPercent', value: 25 },
    { effectType: 'GlobalXPGainMultiplier', value: 0.5 },
  ],
});
const humility = ensureEdict({
  id: 'humility' as EdictId,
  name: 'Humility',
  effects: [{ effectType: 'GlobalLevelStatMultiplier', value: -1 }],
});
const eternal = ensureEdict({
  id: 'eternal' as EdictId,
  name: 'Eternal',
  effects: [{ effectType: 'GlobalShrineBuffsPermanent' }],
});
const knight = ensureJob({
  id: 'knight' as JobId,
  name: 'Knight',
  baseStats: { ...defaultStats(), Health: 100, Strength: 8 },
});

beforeEach(() => {
  seedContent([
    jewelcrafting,
    satchel,
    blessing,
    might,
    frailty,
    fury,
    humility,
    eternal,
    knight,
  ]);
  seedGamestate((state) => (state.clock.numTicks = now));
});

describe('globalEffectEffectsDescription', () => {
  it('renders each effect as a comma-joined "Label: +N[%]" fragment', () => {
    expect(
      globalEffectEffectsDescription([
        { effectType: 'GainStats', stat: 'Strength', value: 5 },
        { effectType: 'GainStatPercent', value: 25 },
        { effectType: 'EnemyStatPercent', stat: 'Health', value: -10 },
        { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
        { effectType: 'GainCombatStat', combatStat: 'agroValue', value: 3 },
        { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
        { effectType: 'GlobalGoldGainMultiplier', value: 0.2 },
        { effectType: 'DebuffResistance', value: 10 },
        { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
        { effectType: 'GlobalCombatItemDropRateBoost', value: 15 },
        { effectType: 'GlobalGatheringItemDropRateBoost', value: 20 },
        { effectType: 'GlobalGatheringItemDropAmountBoost', value: 2 },
        { effectType: 'GlobalGatheringItemFlatBoost', value: 1 },
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
        'Hero stats: +25%',
        'Enemy Health: -10%',
        'Hero Revive Chance: +2%',
        'Hero Aggro: +3',
        'XP Gain: +10%',
        'Gold Gain: +20%',
        'All Debuff Resist: +10%',
        'Accuracy Down Resist: +5%',
        'Item Drop Chance: +15%',
        'Lucky Gather Item Chance: +20%',
        'Lucky Gather Items on Success: +2',
        'Guaranteed Gather Items: +1',
        'Armory Size: +5',
        'Jewelcrafting Queue Size: +1',
        'Unknown Tradeskill Queue Size: +1',
        'Off-Path Travel Speed: +10%',
        'On-Path Travel Speed: +5%',
        'Decree Clause Cap: +1',
      ].join(', '),
    );
  });

  it('rounds scaled values instead of printing float noise', () => {
    expect(
      globalEffectEffectsDescription([
        { effectType: 'GlobalXPGainMultiplier', value: 0.15 * 1.5 },
        { effectType: 'GlobalOffPathTravelSpeedBoost', value: 0.3 * 1.5 },
      ]),
    ).toBe('XP Gain: +22.5%, Off-Path Travel Speed: +45%');
  });
});

describe('globalEffectDescription', () => {
  it('prefers written text, else generates it from the effects', () => {
    const effects: GlobalEffectEffect[] = [
      { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
    ];

    expect(globalEffectDescription({ description: 'Blessed', effects })).toBe(
      'Blessed',
    );
    expect(globalEffectDescription({ description: '', effects })).toBe(
      'XP Gain: +10%',
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
          { effectType: 'GlobalGatheringItemDropAmountBoost', value: 2 },
          { effectType: 'GlobalGatheringItemFlatBoost', value: 1 },
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
      gatheringItemDropAmountBoost: 2,
      gatheringItemFlatBoost: 1,
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

describe('edicts as a source', () => {
  it('adds the run edicts beside timed effects and collectibles', () => {
    const sums = globalEffectSumsFor(
      freshState((s) => {
        s.edicts = [fury.id, 'gone' as EdictId];
        s.globalEffects = [
          active([{ effectType: 'GlobalXPGainMultiplier', value: 0.1 }]),
        ];
        s.collectibles = { [satchel.id]: { quantity: 1, foundAt: 0 } };
      }),
    );

    expect(sums.xpGainMultiplierBonus).toBeCloseTo(0.6);
    expect(sums.armorySizeBoost).toBe(5);
    expect(sums.enemyStatPercents.Strength).toBe(25);
    expect(sums.heroStatPercents).toEqual(defaultStats());
  });

  it('scales one stat on top of all-stat percents, and opposites cancel', () => {
    const sums = globalEffectSumsFor(
      freshState((s) => {
        s.edicts = [might.id];
        s.globalEffects = [
          active([
            { effectType: 'GainStatPercent', stat: 'Health', value: 50 },
          ]),
        ];
      }),
    );
    expect(sums.heroStatPercents).toMatchObject({ Health: 75, Strength: 25 });

    const cancelled = globalEffectSumsFor(
      freshState((s) => (s.edicts = [might.id, frailty.id])),
    );
    expect(cancelled.heroStatPercents).toEqual(defaultStats());
  });
});

describe('hero stat percents on the party', () => {
  function partyState(edicts: EdictId[]): GameState {
    const state = freshState((s) => {
      s.world.party = [buildCharacter({ jobId: knight.id, level: 1, hp: 100 })];
    });
    recomputeGlobalEffectSums(state);
    state.edicts = edicts;
    return state;
  }

  it('recalculates the party when hero percents change', () => {
    const state = partyState([might.id]);

    recomputeGlobalEffectSums(state);

    expect(state.world.party[0].stats).toMatchObject({
      Health: 125,
      Strength: 10,
    });
  });

  it('recalculates the party when the level stat scale changes', () => {
    const state = partyState([humility.id]);
    const party = state.world.party;

    recomputeGlobalEffectSums(state);

    expect(state.world.party).not.toBe(party);
  });

  it('leaves the party untouched when hero percents are unchanged', () => {
    const state = partyState([fury.id]);
    const party = state.world.party;

    recomputeGlobalEffectSums(state);

    expect(state.world.party).toBe(party);
  });

  it('clamps current HP to the new maximum when a percent ends', () => {
    const state = partyState([might.id]);
    recomputeGlobalEffectSums(state);
    state.world.party[0] = { ...state.world.party[0], hp: 125 };

    state.edicts = [];
    recomputeGlobalEffectSums(state);

    expect(state.world.party[0].hp).toBe(100);
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

  it('marks shrine buffs permanent while an edict says so', () => {
    expect(globalEffectSumsFor(freshState()).shrineBuffsPermanent).toBe(false);
    expect(
      globalEffectSumsFor(freshState((st) => (st.edicts = [eternal.id])))
        .shrineBuffsPermanent,
    ).toBe(true);
  });

  it('scales every value of an effect, leaving flags alone', () => {
    const state = freshState();

    applyGlobalEffectAdd(state, blessing.id, 30, now, false, 1.5);
    expect(state.globalEffectSums.stats.Strength).toBe(7.5);

    expect(
      globalEffectEffectsScaled(
        [
          { effectType: 'GlobalXPGainMultiplier', value: 0.2 },
          { effectType: 'GlobalCursedDrops' },
        ],
        2,
      ),
    ).toEqual([
      { effectType: 'GlobalXPGainMultiplier', value: 0.4 },
      { effectType: 'GlobalCursedDrops' },
    ]);
  });

  it('can hide the timer of an effect that normally shows it', () => {
    const state = freshState();

    applyGlobalEffectAdd(state, blessing.id, 30, now, true);

    expect(state.globalEffects[0].hideDuration).toBe(true);
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
