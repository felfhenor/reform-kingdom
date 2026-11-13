import { describe, expect, it } from 'vitest';

import { EDICT_SCORE_MULTIPLIER_FLOOR, PARTY_SIZE_MAX } from '@helpers/config';
import { ensureEdict } from '@helpers/content/ensure-edict';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureSeatBoon } from '@helpers/content/ensure-seatboon';
import {
  applyEdictStartingItems,
  edictIsBlocked,
  edictScoreMultiplier,
  edictSeatBoons,
  edictsActive,
  edictsFragmentTotal,
  edictsPartySize,
  edictsPickable,
  edictsSanitized,
  pruneInvalidEdicts,
} from '@helpers/edict/edict';
import type { EdictContent, EdictId, ItemId, SeatBoonId } from '@interfaces';
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
): EdictContent => ensureEdict({ id: id as EdictId, name: id, ...overrides });

const frailty = pickable('frailty', {
  kind: 'Challenge',
  groups: ['HeroStats'],
});
const strength = pickable('strength', { kind: 'Boon', groups: ['HeroStats'] });
const sky = pickable('sky', { kind: 'Variant', groups: ['Sky', 'Coin'] });
const coin = pickable('coin', { kind: 'Variant' });
const loneWolf = ensureSeatBoon({
  id: 'lone-wolf' as SeatBoonId,
  name: 'Lone Wolf',
});
const loneWolfAsEdict = loneWolf.id as unknown as EdictId;
const triad = pickable('triad', {
  kind: 'PartySize',
  partySize: 3,
  seatBoonIds: [loneWolf.id],
});
const duo = pickable('duo', { kind: 'PartySize', partySize: 2 });

describe('edictsPickable', () => {
  it('lists edicts by kind then name, leaving out seat boons', () => {
    seedContent([strength, coin, loneWolf, frailty, triad]);

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

  it('blocks on any shared group, so a multi-group edict can block edicts that allow each other', () => {
    const skyOnly = pickable('sky-only', { groups: ['Sky'] });
    const coinOnly = pickable('coin-only', { groups: ['Coin'] });

    expect(edictIsBlocked(sky, [skyOnly])).toBe(true);
    expect(edictIsBlocked(coinOnly, [sky])).toBe(true);
    expect(edictIsBlocked(skyOnly, [coinOnly])).toBe(false);
  });
});

describe('edictsSanitized', () => {
  it('keeps pickable ids in order, dropping repeats, unpickable and later-blocked ones', () => {
    seedContent([strength, coin, loneWolf, frailty, triad]);

    expect(
      edictsSanitized([
        coin.id,
        frailty.id,
        coin.id,
        loneWolfAsEdict,
        strength.id,
        gone,
      ]),
    ).toEqual([coin.id, frailty.id]);
  });
});

describe('edictSeatBoons', () => {
  it('resolves seat boons in order, skipping ids that are not seat boons', () => {
    seedContent([loneWolf, ore]);
    const edict = pickable('mixed', {
      seatBoonIds: [
        'gone' as SeatBoonId,
        ore.id as unknown as SeatBoonId,
        loneWolf.id,
      ],
    });

    expect(edictSeatBoons(edict)).toEqual([loneWolf]);
  });
});

describe('edictsPartySize', () => {
  it('is the smallest picked party size, or the full party without one', () => {
    expect(edictsPartySize([])).toBe(PARTY_SIZE_MAX);
    expect(edictsPartySize([coin])).toBe(PARTY_SIZE_MAX);
    expect(edictsPartySize([coin, triad, duo])).toBe(2);
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
    expect(edictScoreMultiplier(-50)).toBe(EDICT_SCORE_MULTIPLIER_FLOOR);
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
