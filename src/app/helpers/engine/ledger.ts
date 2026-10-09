import type { Ledger } from '@interfaces';

export function ledgerHas<K extends string>(
  ledger: Ledger<K>,
  key: K,
): boolean {
  return !!ledger[key]?.foundAt;
}

// Keeps the first foundAt if the key is already recorded.
export function ledgerMark<K extends string>(
  ledger: Ledger<K>,
  key: K,
  foundAt = Date.now(),
): void {
  ledger[key] ??= { foundAt };
}

export function ledgerPrune<K extends string>(
  ledger: Ledger<K>,
  keep: (key: K) => boolean,
): Ledger<K> {
  return Object.fromEntries(
    Object.entries(ledger).filter(([key]) => keep(key as K)),
  ) as Ledger<K>;
}
