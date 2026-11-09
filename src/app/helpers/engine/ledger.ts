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

// Returns a copy with every missing key stamped now; existing entries keep their foundAt.
export function ledgerBackfill<K extends string>(
  ledger: Ledger<K>,
  keys: K[],
): Ledger<K> {
  const backfilled = { ...ledger };
  keys.forEach((key) => ledgerMark(backfilled, key));

  return backfilled;
}
