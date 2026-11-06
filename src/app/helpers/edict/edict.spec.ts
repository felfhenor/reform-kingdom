import { describe, expect, it } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import { ensureItem } from '@helpers/content/ensure-item';
import {
  applyEdictStartingItems,
  edictIsBlocked,
  edictScoreMultiplier,
  edictsActive,
  edictsFragmentTotal,
  edictsPickable,
  edictsSanitized,
  pruneInvalidEdicts,
} from '@helpers/edict/edict';
import type { EdictContent, EdictId, ItemId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { gamestate, updateGamestate } from '@helpers/state-game';

const might = ensureEdict({ id: 'might' as EdictId, name: 'Edict of Might' });
const famine = ensureEdict({
  id: 'famine' as EdictId,
  name: 'Edict of Famine',
});
const ore = ensureItem({ id: 'ore' as ItemId, name: 'Ore' });
const oreAsEdict = ore.id as unknown as EdictId;
const gone = 'gone' as EdictId;

describe('edictsActive', () => {
  it('resolves picked edicts in order, skipping ids that are not edicts', () => {
    seedContent([might, famine, ore]);
    seedGamestate((state) => {
      state.edicts = [famine.id, gone, oreAsEdict, might.id, famine.id];
    });

    expect(edictsActive().map((edict) => edict.id)).toEqual([
      famine.id,
      might.id,
    ]);
  });

  it('is empty for a run without edicts', () => {
    seedContent([might]);
    seedGamestate();

    expect(edictsActive()).toEqual([]);
  });
});

describe('pruneInvalidEdicts', () => {
  it('keeps only ids of edict content', () => {
    seedContent([might, ore]);

    expect(pruneInvalidEdicts([might.id, gone, oreAsEdict])).toEqual([
      might.id,
    ]);
  });

  it('drops edict names, which getEntry would otherwise resolve', () => {
    seedContent([might]);

    expect(pruneInvalidEdicts([might.name as EdictId])).toEqual([]);
  });

  it('drops repeats so an edict never counts twice', () => {
    seedContent([might, famine]);

    expect(pruneInvalidEdicts([might.id, famine.id, might.id])).toEqual([
      might.id,
      famine.id,
    ]);
  });
});

const pickable = (
  id: string,
  overrides: Partial<EdictContent> = {},
): EdictContent =>
  ensureEdict({ id: id as EdictId, name: id, enabled: true, ...overrides });

const frailty = pickable('frailty', { kind: 'Challenge', group: 'HeroStats' });
const strength = pickable('strength', { kind: 'Boon', group: 'HeroStats' });
const coin = pickable('coin', { kind: 'Variant' });
const triad = pickable('triad', { kind: 'PartySize' });
const loneWolf = pickable('lone-wolf', { kind: 'SeatBoon' });
const locked = ensureEdict({
  id: 'locked' as EdictId,
  name: 'locked',
  kind: 'Challenge',
});

describe('edictsPickable', () => {
  it('lists enabled edicts by kind then name, leaving out seat boons', () => {
    seedContent([strength, coin, loneWolf, locked, frailty, triad]);

    expect(edictsPickable().map((edict) => edict.id)).toEqual([
      triad.id,
      frailty.id,
      coin.id,
      strength.id,
    ]);
  });
});

describe('edictIsBlocked', () => {
  it('blocks an edict when another picked one shares its group', () => {
    expect(edictIsBlocked(strength, [frailty])).toBe(true);
    expect(edictIsBlocked(strength, [strength])).toBe(false);
    expect(edictIsBlocked(coin, [frailty, strength])).toBe(false);
    expect(edictIsBlocked(coin, [triad])).toBe(false);
  });
});

describe('edictsSanitized', () => {
  it('keeps pickable ids in order, dropping repeats, unpickable and later-blocked ones', () => {
    seedContent([strength, coin, loneWolf, locked, frailty, triad]);

    expect(
      edictsSanitized([
        coin.id,
        frailty.id,
        coin.id,
        loneWolf.id,
        locked.id,
        strength.id,
        gone,
      ]),
    ).toEqual([coin.id, frailty.id]);
  });
});

describe('edict scoring', () => {
  it('sums Fragments and scales the multiplier by them', () => {
    const fragments = edictsFragmentTotal([
      ensureEdict({ fragments: 3 }),
      ensureEdict({ fragments: -1 }),
    ]);

    expect(fragments).toBe(2);
    expect(edictScoreMultiplier(fragments)).toBeCloseTo(1.2);
  });

  it('never drops the multiplier below its floor', () => {
    expect(edictScoreMultiplier(-50)).toBe(0.25);
  });
});

describe('applyEdictStartingItems', () => {
  it("adds each picked edict's starting items, stacking with existing stock", () => {
    const frailty = ensureEdict({
      id: 'frailty' as EdictId,
      name: 'Edict of Frailty',
      startingItems: [{ itemId: ore.id, quantity: 4 }],
    });
    const fury = ensureEdict({
      id: 'fury' as EdictId,
      name: 'Edict of Fury',
      startingItems: [{ itemId: ore.id, quantity: 4 }],
    });
    seedContent([frailty, fury, might, ore]);
    seedGamestate((state) => {
      state.edicts = [frailty.id, fury.id, might.id];
      state.materials[ore.id] = { quantity: 1, foundAt: 0 };
    });

    inTick(() =>
      updateGamestate((state) => {
        applyEdictStartingItems(state);
        return state;
      }),
    );

    expect(gamestate().materials[ore.id]?.quantity).toBe(9);
  });
});
