import { beforeEach, describe, expect, it } from 'vitest';

import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import {
  raidDefenseGlobalEffectApply,
  raidTelegraphClear,
} from '@helpers/town/raid/town-raid-defense';
import type {
  GameState,
  GlobalEffectId,
  MonsterId,
  TownId,
  TownNodeState,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';

const now = 1000;
// Looked up by name, so the stored id differs on purpose.
const raidEffect = ensureGlobalEffect({
  id: 'raid-defense-requested' as GlobalEffectId,
  name: 'Raid Defense Requested',
});
const larsia = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
const vesper = ensureTown({ id: 'vesper' as TownId, name: 'Vesper' });

const telegraphed: Partial<TownNodeState> = {
  raidTelegraphedAtTick: 900,
  raidEngageWindowExpiresAtTick: 2000,
  raidTelegraphedAssaulterIds: ['bloodmoth' as MonsterId],
};

function stateWith(
  towns: Partial<Record<TownId, Partial<TownNodeState>>>,
  existingEffect = false,
): GameState {
  const state = defaultGameState();
  Object.entries(towns).forEach(([id, town]) => {
    state.world.towns[id as TownId] = buildTownNodeState(town);
  });
  if (existingEffect) {
    state.globalEffects = [{ ...raidEffect, startTick: 0, expiresAtTick: 10 }];
  }
  return state;
}

function raidEffects(state: GameState) {
  return state.globalEffects.filter(({ id }) => id === raidEffect.id);
}

beforeEach(() => {
  seedContent([raidEffect, larsia, vesper]);
});

describe('raidDefenseGlobalEffectApply', () => {
  it('replaces the effect with one listing every telegraphed town', () => {
    const state = stateWith(
      { [larsia.id]: telegraphed, [vesper.id]: telegraphed },
      true,
    );

    raidDefenseGlobalEffectApply(state, now);

    expect(raidEffects(state)).toEqual([
      expect.objectContaining({
        extendedDescription: 'Larsia, Vesper',
        startTick: now,
      }),
    ]);
  });

  it('drops the effect once no town is telegraphed, ignoring towns gone from content', () => {
    const state = stateWith(
      { [larsia.id]: {}, ['gone' as TownId]: telegraphed },
      true,
    );

    raidDefenseGlobalEffectApply(state, now);

    expect(raidEffects(state)).toEqual([]);
  });

  it('does nothing without the effect content', () => {
    seedContent([larsia]);
    const state = stateWith({ [larsia.id]: telegraphed });

    raidDefenseGlobalEffectApply(state, now);

    expect(state.globalEffects).toEqual([]);
  });
});

describe('raidTelegraphClear', () => {
  it('clears the town’s telegraph, keeps its raid history and re-syncs the effect', () => {
    const state = stateWith(
      {
        [larsia.id]: { ...telegraphed, lastRaidResolvedAtTick: 50 },
        [vesper.id]: telegraphed,
      },
      true,
    );

    raidTelegraphClear(state, larsia.id, now);

    expect(state.world.towns[larsia.id]).toMatchObject({
      raidTelegraphedAtTick: undefined,
      raidEngageWindowExpiresAtTick: undefined,
      raidTelegraphedAssaulterIds: undefined,
      lastRaidResolvedAtTick: 50,
    });
    expect(raidEffects(state)).toEqual([
      expect.objectContaining({ extendedDescription: 'Vesper' }),
    ]);
  });

  it('still re-syncs the effect for a town never visited', () => {
    const state = stateWith({}, true);

    raidTelegraphClear(state, larsia.id, now);

    expect(state.world.towns).toEqual({});
    expect(raidEffects(state)).toEqual([]);
  });
});
