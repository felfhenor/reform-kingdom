// What a trade's live re-check decided; the non-executed outcomes besides `rejected` warn the player.
export type TradeCommitOutcome =
  'executed' | 'rejected' | 'armoryFull' | 'vanished';
