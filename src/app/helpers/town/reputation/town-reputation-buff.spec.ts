import { describe, expect, it } from 'vitest';

import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { globalEffectsState } from '@helpers/state-game';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import {
  townReputationBuffEffects,
  townReputationBuffRefresh,
} from '@helpers/town/reputation/town-reputation-buff';
import type {
  GameState,
  GlobalEffectId,
  TownId,
  TownReputationBuffTier,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const desert = 'LarsianDesert';
const now = 500;
const buff = ensureGlobalEffect({
  id: 'larsian-influence' as GlobalEffectId,
  name: 'Larsian Influence',
  sprite: '0010',
});

function tier(
  overrides: Partial<TownReputationBuffTier>,
): TownReputationBuffTier {
  return {
    tier: 1,
    stats: defaultStats(),
    combatStats: defaultCombatStats(),
    debuffResistances: defaultTagResistances(),
    ...overrides,
  };
}

const larsia = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  reputation: {
    buff: {
      globalEffectId: buff.id,
      tiers: [tier({ stats: { ...defaultStats(), Strength: 1 } })],
    },
  },
});

function seedTown(reputationTier: number, activeEffect = false): void {
  seedContent([buff, larsia]);
  seedWorldNodes([
    { name: larsia.name, type: 'NonPlayerKingdom', mapName: desert },
  ]);
  seedGamestate((state: GameState) => {
    state.clock.numTicks = now;
    state.world.towns[larsia.id] = buildTownNodeState({
      reputation: TOWN_REPUTATION_THRESHOLDS[reputationTier],
    });
    if (activeEffect) {
      state.globalEffects = [{ ...buff, startTick: 0, expiresAtTick: 1000 }];
    }
  });
}

function activeBuffs() {
  return globalEffectsState().filter(({ id }) => id === buff.id);
}

const refresh = (mapName: string) =>
  inTick(() => townReputationBuffRefresh(mapName));

describe('townReputationBuffEffects', () => {
  it('lists only the non-zero stats, combat stats and resistances', () => {
    expect(
      townReputationBuffEffects(
        tier({
          stats: { ...defaultStats(), Strength: 1 },
          combatStats: { ...defaultCombatStats(), reviveChance: 2 },
          debuffResistances: { ...defaultTagResistances(), Accuracy: 5 },
        }),
      ),
    ).toEqual([
      { effectType: 'GainStats', stat: 'Strength', value: 1 },
      { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
      { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
    ]);
  });
});

describe('townReputationBuffRefresh', () => {
  it('grants the town’s buff for its tier on its map, described from the tier', () => {
    seedTown(1);

    refresh(desert);

    expect(activeBuffs()).toEqual([
      expect.objectContaining({
        name: buff.name,
        sprite: buff.sprite,
        effects: [{ effectType: 'GainStats', stat: 'Strength', value: 1 }],
        extendedDescription: expect.stringContaining('Strength'),
      }),
    ]);
  });

  it('drops the buff off its map', () => {
    seedTown(1, true);
    refresh('Carrina');
    expect(activeBuffs()).toEqual([]);
  });

  it('grants nothing at a tier without a buff, or once the buff or node is gone', () => {
    seedTown(0);
    refresh(desert);
    expect(activeBuffs()).toEqual([]);

    seedTown(1);
    seedContent([larsia]);
    refresh(desert);
    expect(globalEffectsState()).toEqual([]);

    seedTown(1);
    seedWorldNodes([]);
    refresh(desert);
    expect(activeBuffs()).toEqual([]);
  });

  it('re-derives the buff in place, replacing the old one', () => {
    seedTown(1, true);

    refresh(desert);

    expect(activeBuffs()).toEqual([
      expect.objectContaining({ startTick: now, effects: [expect.anything()] }),
    ]);
  });
});
