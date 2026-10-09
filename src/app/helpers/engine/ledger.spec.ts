import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ledgerHas, ledgerMark, ledgerPrune } from '@helpers/engine/ledger';
import type { Ledger } from '@interfaces';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(5000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ledgerHas', () => {
  it('is true only for recorded keys', () => {
    const ledger: Ledger = { a: { foundAt: 1000 } };

    expect(ledgerHas(ledger, 'a')).toBe(true);
    expect(ledgerHas(ledger, 'b')).toBe(false);
  });
});

describe('ledgerMark', () => {
  it('stamps a new key now and keeps the original foundAt on repeats', () => {
    const ledger: Ledger = { a: { foundAt: 1000 } };

    ledgerMark(ledger, 'a');
    ledgerMark(ledger, 'b');

    expect(ledger).toEqual({ a: { foundAt: 1000 }, b: { foundAt: 5000 } });
  });

  it('uses an explicit foundAt for new keys', () => {
    const ledger: Ledger = {};

    ledgerMark(ledger, 'a', 42);

    expect(ledger).toEqual({ a: { foundAt: 42 } });
  });
});

describe('ledgerPrune', () => {
  it('keeps only the keys the predicate accepts, without mutating the input', () => {
    const ledger: Ledger = { a: { foundAt: 1 }, b: { foundAt: 2 } };

    expect(ledgerPrune(ledger, (key) => key === 'a')).toEqual({
      a: { foundAt: 1 },
    });
    expect(Object.keys(ledger)).toEqual(['a', 'b']);
  });
});
