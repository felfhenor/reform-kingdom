export type LedgerEntry = { foundAt: number };

// Permanent "ever found/seen" record; never pruned when the underlying thing is spent or lost.
export type Ledger<K extends string = string> = { [P in K]: LedgerEntry };
