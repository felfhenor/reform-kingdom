import { describe, expect, it } from 'vitest';

import { ensureEdict } from '@helpers/content/ensure-edict';
import { ensureItem } from '@helpers/content/ensure-item';
import { edictsActive, pruneInvalidEdicts } from '@helpers/edict/edict';
import type { EdictId, ItemId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

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
